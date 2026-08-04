declare module "html-to-docx" {
  export default function HTMLtoDOCX(
    html: string,
    headerHTML?: string,
    options?: Record<string, unknown>,
    footerHTML?: string
  ): Promise<Buffer>;
}
