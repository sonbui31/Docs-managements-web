import { Request } from "express";

export const REFRESH_COOKIE_NAME = "ba_refresh_token";

export function readCookie(request: Request, name: string) {
  const cookieHeader = request.headers.cookie;
  if (!cookieHeader) return undefined;

  const cookies = cookieHeader.split(";").map((cookie) => cookie.trim());
  const cookie = cookies.find((item) => item.startsWith(`${name}=`));
  if (!cookie) return undefined;

  return decodeURIComponent(cookie.slice(name.length + 1));
}
