import {test,expect} from "@playwright/test";
const preview=process.env.MEMBER_PREVIEW_URL!;

test("member gallery keeps Swiper arrows, thumbnails, lightbox counter and Escape",async({page,isMobile})=>{
  const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));
  await page.goto(preview+"/place/100-cafe-moto/");
  await expect(page.locator(".upd-gallery")).toHaveAttribute("data-gallery-ready","true");
  await expect(page.locator(".place-title")).toHaveText("100% Cafe Moto");
  await page.getByRole("button",{name:"Next slide",exact:true}).click();
  await expect(page.locator(".upd-gallery__main .swiper-slide-active img")).toHaveAttribute("alt","100% Cafe Moto, photo 2");
  await page.getByRole("button",{name:"Show photo 4",exact:true}).click();
  await expect(page.locator(".upd-gallery__main .swiper-slide-active img")).toHaveAttribute("alt","100% Cafe Moto, photo 4");
  await page.locator(".upd-gallery__main .swiper-slide-active a").click();
  await expect(page.locator(".glightbox-container")).toBeVisible();
  await expect(page.locator(".upd-lightbox-counter")).toHaveText("4/8");
  await page.getByRole("button",{name:"Go to photo 6",exact:true}).click();
  await expect(page.locator(".upd-lightbox-counter")).toHaveText("6/8");
  if(!isMobile){await page.keyboard.press("ArrowRight");await expect(page.locator(".upd-lightbox-counter")).toHaveText("7/8");}
  await page.keyboard.press("Escape");
  await expect(page.locator(".glightbox-container")).toHaveCount(0);
  await expect(page.locator(".place-map-embed")).toHaveAttribute("data-map-ready","true",{timeout:35000});
  await expect(page.getByRole("button",{name:"Post review",exact:true})).toBeDisabled();
  expect(errors).toEqual([]);
});

test("member template omits absent data and retains the single-photo variant",async({page})=>{
  test.skip(!preview.endsWith(":3002"),"These two exported destinations require the Explorer+ preview.");
  await page.goto(preview+"/place/arutayan-falls/");
  await expect(page.locator(".place-title")).toHaveText("Arutayan Falls");
  await expect(page.locator(".upd-gallery")).toHaveCount(0);
  await expect(page.locator(".place-map-embed")).toHaveCount(0);
  await expect(page.locator(".upd-place-details")).toHaveCount(0);
  await page.goto(preview+"/place/talaudyong-beach-ii/");
  await expect(page.locator(".upd-gallery")).toHaveAttribute("data-gallery-ready","true");
  await expect(page.locator(".upd-gallery__main .swiper-slide")).toHaveCount(1);
  await expect(page.locator(".upd-gallery__arrow")).toHaveCount(0);
  await expect(page.locator(".upd-gallery__thumbs")).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);
});

test("Explorer tier keeps the Explorer+ upgrade gate",async({page})=>{
  test.skip(preview.endsWith(":3002"),"Explorer+ development preview is allowed to render this template.");
  await page.goto(preview+"/place/bayog-beach/");
  await expect(page.locator(".upd-upgrade")).toBeVisible();
  await expect(page.locator(".upd-gallery")).toHaveCount(0);
  await expect(page.locator(".place-map-embed")).toHaveCount(0);
});

test("representative pages preserve duplicate photos without React errors or overflow",async({page})=>{
  test.skip(!preview.endsWith(":3002"),"Complete destination bodies require the Explorer+ development preview.");
  const errors:string[]=[];
  page.on("console",message=>{if(message.type()==="error"&&/same key|hydration|uncaught/i.test(message.text()))errors.push(message.text());});
  page.on("pageerror",error=>errors.push(error.message));
  for(const slug of ["100-cafe-moto","arutayan-falls","aloha-organic-ranch","farm-lot","talaudyong-beach-ii","dondon-claudia-river","ang-nanay-filipino-food","barlas-island","mt-airy-pending-info","bayog-beach"]){
    await page.goto(preview+`/place/${slug}/`);
    await expect(page.locator(".place-title")).toBeVisible();
    expect(await page.evaluate(()=>document.body.scrollWidth<=innerWidth+2),slug).toBe(true);
  }
  expect(errors).toEqual([]);
});
