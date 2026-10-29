"use client";
import { ContentImage } from "@/components/ui/content-image";
import { imageDeliveryUrl } from "@/lib/image-delivery";
import { useEffect, useRef } from "react";
import { loadBrowserAsset } from "@/lib/browser-assets";

interface Slider { destroy(deleteInstance?:boolean,cleanStyles?:boolean):void }
interface Lightbox {
  elements:unknown[];
  index:number;
  on(event:string,handler:(data?:{current?:{index?:number}})=>void):void;
  goToSlide(index:number):void;
  destroy():void;
}
type GalleryWindow=Window&{
  Swiper:new(element:Element,options:Record<string,unknown>)=>Slider;
  GLightbox:(options:Record<string,unknown>)=>Lightbox;
};

export function Gallery({ images, title }: { images:string[]; title:string }) {
  const root=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!images.length)return;
    let disposed=false,main:Slider|undefined,thumbs:Slider|undefined,lightbox:Lightbox|undefined;
    const host=root.current;
    async function initialize(){
      await Promise.all([loadBrowserAsset("/original/vendor/swiper-bundle.min.js"),loadBrowserAsset("/original/vendor/glightbox.min.js")]);
      if(disposed||!host)return;
      const browser=window as unknown as GalleryWindow;
      const thumbEl=host.querySelector(".upd-gallery__thumbs");
      if(thumbEl)thumbs=new browser.Swiper(thumbEl,{slidesPerView:"auto",spaceBetween:8,watchSlidesProgress:true,freeMode:true,centerInsufficientSlides:true,a11y:{slideRole:"button",slideLabelMessage:"Show photo {{index}}"}});
      main=new browser.Swiper(host.querySelector(".upd-gallery__main")!,{
        loop:true,keyboard:{enabled:true},navigation:{prevEl:host.querySelector(".upd-gallery__arrow--prev"),nextEl:host.querySelector(".upd-gallery__arrow--next")},...(thumbs?{thumbs:{swiper:thumbs}}:{})
      });
      lightbox=browser.GLightbox({selector:".glightbox",loop:true,zoomable:true,touchNavigation:true,closeOnOutsideClick:true});
      let counter:HTMLDivElement|undefined,dots:HTMLDivElement|undefined;
      function update(index:number){
        if(counter)counter.textContent=`${index+1}/${images.length}`;
        dots?.querySelectorAll("button").forEach((dot,i)=>dot.classList.toggle("upd-lightbox-dot--active",i===index));
      }
      lightbox.on("open",()=>{
        const container=document.querySelector(".glightbox-container");if(!container||images.length<=1)return;
        counter=document.createElement("div");counter.className="upd-lightbox-counter";container.appendChild(counter);
        dots=document.createElement("div");dots.className="upd-lightbox-dots";
        dots.addEventListener("click",event=>event.stopPropagation());
        images.forEach((_,i)=>{const dot=document.createElement("button");dot.type="button";dot.className="upd-lightbox-dot";dot.setAttribute("aria-label",`Go to photo ${i+1}`);dot.addEventListener("click",event=>{event.preventDefault();event.stopPropagation();lightbox?.goToSlide(i);});dots!.appendChild(dot);});
        container.appendChild(dots);update(lightbox?.index||0);
      });
      lightbox.on("slide_changed",data=>update(data?.current?.index??lightbox?.index??0));
      lightbox.on("close",()=>{counter=undefined;dots=undefined;});
      host.setAttribute("data-gallery-ready","true");
    }
    void initialize().catch(()=>{/* Images retain normal links if browser enhancement cannot load. */});
    return()=>{disposed=true;lightbox?.destroy();main?.destroy(true,true);thumbs?.destroy(true,true);};
  },[images]);
  if(!images.length)return null;
  return <div className="upd-gallery upd-gallery--inline" data-photo-count={images.length} ref={root} aria-label={`${title} gallery`}>
    <div className="upd-gallery__main swiper">
      <div className="swiper-wrapper">{images.map((url,i)=><div className="swiper-slide" key={`${i}:${url}`}><a className="glightbox upd-gallery__slide-link" href={imageDeliveryUrl(url, 1920)} data-gallery="place-gallery" aria-label={`Open photo ${i+1} of ${images.length}`}><ContentImage sizes="(max-width: 900px) 100vw, 900px" className="upd-gallery__photo" src={url} alt={`${title}, photo ${i+1}`} loading={i===0?"eager":"lazy"} /></a></div>)}</div>
      {images.length>1&&<><button type="button" className="upd-gallery__arrow upd-gallery__arrow--prev" aria-label="Previous slide" /><button type="button" className="upd-gallery__arrow upd-gallery__arrow--next" aria-label="Next slide" /></>}
    </div>
    {images.length>1&&<div className="upd-gallery__thumbs swiper"><div className="swiper-wrapper">{images.map((url,i)=><div className="swiper-slide" key={`${i}:${url}`} role="button" tabIndex={0} aria-label={`Show photo ${i+1}`} onKeyDown={event=>{if(event.key==="Enter"||event.key===" ")event.currentTarget.click();}}><ContentImage sizes="80px" src={url} alt="" loading="lazy" /></div>)}</div></div>}
  </div>;
}
