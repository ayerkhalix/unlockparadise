import "server-only";
import fragments from "@/data/fragments.json";
import assets from "@/data/assets.json";

export function fragment(name: string): string | undefined {
  return (fragments as Record<string, string>)[name];
}

export function localAsset(url: string): string {
  return (assets.assets as Record<string, string>)[url] || url;
}

export const originalStylesheets = assets.stylesheets;
