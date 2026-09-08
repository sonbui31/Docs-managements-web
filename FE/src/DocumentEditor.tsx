import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Heading from "@tiptap/extension-heading";
import Underline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import { Extension } from "@tiptap/core";
import TextAlign from "@tiptap/extension-text-align";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TableRow from "@tiptap/extension-table-row";
import Placeholder from "@tiptap/extension-placeholder";
import {
  AArrowDown,
  AArrowUp,
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ALargeSmall,
  Bold,
  Check,
  ChevronDown,
  Columns3,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  ImagePlus,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Palette,
  Pilcrow,
  Quote,
  Redo2,
  Rows3,
  Table2,
  Trash2,
  Type,
  Underline as UnderlineIcon,
  Undo2,
  X
} from "lucide-react";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";

export type EditorTocItem = {
  id: string;
  index: number;
  text: string;
  level: number;
};

type DocumentEditorProps = {
  documentId: string;
  initialHtml: string;
  fontSize: "sm" | "md" | "lg";
  isSaving: boolean;
  contentRef: RefObject<HTMLDivElement | null>;
  onSave: (html: string) => Promise<void>;
  onCancel: () => void;
  onHeadingsChange: (items: EditorTocItem[]) => void;
  onUploadImage?: (file: File) => Promise<string>;
};

const TEXT_COLORS = ["#0f172a", "#475569", "#dc2626", "#d97706", "#059669", "#2563eb", "#7c3aed"];
const HIGHLIGHT_COLORS = ["#fef3c7", "#fee2e2", "#dcfce7", "#dbeafe", "#ede9fe", "#f1f5f9"];
const FONT_SIZES = ["12", "14", "16", "18", "20", "24", "28", "32"];
const AUTO_SAVE_DELAY_MS = 400;
const FONT_FAMILIES = [
  { label: "Inter", value: "" },
  { label: "Roboto", value: "Roboto" },
  { label: "Open Sans", value: "Open Sans" },
  { label: "Poppins", value: "Poppins" },
  { label: "Montserrat", value: "Montserrat" },
  { label: "Nunito", value: "Nunito" },
  { label: "Raleway", value: "Raleway" },
  { label: "Oswald", value: "Oswald" },
  { label: "Play", value: "Play" },
  { label: "Lora", value: "Lora" },
  { label: "Playfair Display", value: "Playfair Display" },
  { label: "PT Serif", value: "PT Serif" },
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Times New Roman", value: "Times New Roman, Times, serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Courier New", value: "Courier New, monospace" },
  { label: "Roboto Mono", value: "Roboto Mono" },
  { label: "Source Code Pro", value: "Source Code Pro, monospace" },
];

const FontSize = Extension.create({
  name: "fontSize",
  addGlobalAttributes() {
    return [{
      types: ["textStyle"],
      attributes: {
        fontSize: {
          default: null,
          parseHTML: (element) => element.style.fontSize?.replace(/px$/, "") || null,
          renderHTML: (attributes) => {
            if (!attributes.fontSize) return {};
            return { style: `font-size: ${attributes.fontSize}px` };
          }
        }
      }
    }];
  }
});

const FontFamily = Extension.create({
  name: "fontFamily",
  addGlobalAttributes() {
    return [{
      types: ["textStyle"],
      attributes: {
        fontFamily: {
          default: null,
          parseHTML: (element) => element.style.fontFamily || null,
          renderHTML: (attributes) => {
            if (!attributes.fontFamily) return {};
            return { style: `font-family: ${attributes.fontFamily}` };
          }
        }
      }
    }];
  }
});

function slugifyHeading(text: string) {
  const slug = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "heading";
}

const HeadingWithId = Heading.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute("id"),
        renderHTML: (attributes) => (attributes.id ? { id: attributes.id } : {})
      }
    };
  }
}).configure({ levels: [1, 2, 3] });

function syncHeadingIds(editor: Editor, documentId: string) {
  const usedIds = new Set<string>();
  const updates: Array<{ pos: number; attrs: Record<string, unknown> }> = [];
  const items: EditorTocItem[] = [];

  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== "heading") return;
    const level = Number(node.attrs.level) || 1;
    const text = node.textContent.trim();
    if (!text) return;

    let base = slugifyHeading(text);
    let candidate = `${documentId}-${base}`;
    let counter = 2;
    while (usedIds.has(candidate)) {
      candidate = `${documentId}-${base}-${counter}`;
      counter++;
    }
    usedIds.add(candidate);

    if (node.attrs.id !== candidate) {
      updates.push({ pos, attrs: { ...node.attrs, id: candidate } });
    }

    items.push({
      id: candidate,
      index: items.length,
      text,
      level
    });
  });

  if (updates.length > 0) {
    const { tr } = editor.state;
    for (const { pos, attrs } of updates) {
      tr.setNodeMarkup(pos, undefined, attrs);
    }
    editor.view.dispatch(tr);
  }

  return items;
}

function currentBlock(editor: Editor): string {
  if (!editor) return "paragraph";
  if (editor.isActive("heading", { level: 1 })) return "h1";
  if (editor.isActive("heading", { level: 2 })) return "h2";
  if (editor.isActive("heading", { level: 3 })) return "h3";
  return "paragraph";
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(String(event.target?.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Cannot read file"));
    reader.readAsDataURL(file);
  });
}

export function DocumentEditor({
  documentId,
  initialHtml,
  fontSize,
  isSaving,
  contentRef,
  onSave,
  onCancel,
  onHeadingsChange,
  onUploadImage
}: DocumentEditorProps) {
  const [isDirty, setIsDirty] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);
  const [openColorPicker, setOpenColorPicker] = useState<"text" | "highlight" | null>(null);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [isBlockPickerOpen, setIsBlockPickerOpen] = useState(false);
  const blockPickerRef = useRef<HTMLDivElement>(null);
  const [isFontSizeOpen, setIsFontSizeOpen] = useState(false);
  const fontSizeRef = useRef<HTMLDivElement>(null);
  const [isFontFamilyOpen, setIsFontFamilyOpen] = useState(false);
  const fontFamilyRef = useRef<HTMLDivElement>(null);
  const [fontFamilySearch, setFontFamilySearch] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_selectionKey, setSelectionKey] = useState(0);
  const [autoSaveStatus, setAutoSaveStatus] = useState<"saved" | "dirty" | "saving" | "retrying">("saved");
  const saveTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const saveInFlightRef = useRef(false);
  const pendingSaveAfterFlightRef = useRef(false);
  const latestHtmlRef = useRef(initialHtml || "");
  const lastSavedHtmlRef = useRef(initialHtml || "");
  const loadedDocumentIdRef = useRef<string | null>(null);
  const editorRef = useRef<Editor | null>(null);
  const onSaveRef = useRef(onSave);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  const resolveImageSrc = useCallback(async (file: File) => {
    setIsUploadingImage(true);
    setImageUploadError(null);
    try {
      return onUploadImage ? await onUploadImage(file) : await readFileAsDataUrl(file);
    } catch (error) {
      console.error("Upload editor image error:", error);
      setImageUploadError("Không upload được ảnh");
      throw error;
    } finally {
      setIsUploadingImage(false);
    }
  }, [onUploadImage]);

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: false
      }),
      HeadingWithId,
      Underline,
      TextAlign.configure({
        types: ["heading", "paragraph"]
      }),
      TextStyle,
      FontSize,
      FontFamily,
      Color,
      Highlight.configure({ multicolor: true }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true
      }),
      Image.configure({ inline: false, allowBase64: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({ placeholder: "Soạn nội dung tài liệu..." })
    ],
    []
  );

  const clearAutoSaveTimer = useCallback(() => {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
  }, []);

  const saveLatest = useCallback(async () => {
    if (saveInFlightRef.current) {
      pendingSaveAfterFlightRef.current = true;
      return;
    }

    clearAutoSaveTimer();
    const htmlToSave = latestHtmlRef.current;
    if (htmlToSave === lastSavedHtmlRef.current) {
      setIsDirty(false);
      setAutoSaveStatus("saved");
      return;
    }

    saveInFlightRef.current = true;
    setAutoSaveStatus("saving");
    try {
      await onSaveRef.current(htmlToSave);
      lastSavedHtmlRef.current = htmlToSave;

      const currentHtml = editorRef.current?.getHTML() ?? latestHtmlRef.current;
      latestHtmlRef.current = currentHtml;
      if (currentHtml === htmlToSave) {
        setIsDirty(false);
        setAutoSaveStatus("saved");
      } else {
        setIsDirty(true);
        setAutoSaveStatus("dirty");
        pendingSaveAfterFlightRef.current = true;
      }
    } catch {
      setIsDirty(true);
      setAutoSaveStatus("retrying");
      pendingSaveAfterFlightRef.current = false;
      saveTimerRef.current = window.setTimeout(() => {
        void saveLatest().catch(() => undefined);
      }, AUTO_SAVE_DELAY_MS * 3);
    } finally {
      saveInFlightRef.current = false;
      if (pendingSaveAfterFlightRef.current) {
        pendingSaveAfterFlightRef.current = false;
        if (latestHtmlRef.current !== lastSavedHtmlRef.current) {
          saveTimerRef.current = window.setTimeout(() => {
            void saveLatest().catch(() => undefined);
          }, AUTO_SAVE_DELAY_MS);
        }
      }
    }
  }, [clearAutoSaveTimer]);

  const scheduleAutoSave = useCallback(() => {
    clearAutoSaveTimer();
    saveTimerRef.current = window.setTimeout(() => {
      void saveLatest().catch(() => undefined);
    }, AUTO_SAVE_DELAY_MS);
  }, [clearAutoSaveTimer, saveLatest]);

  const editor = useEditor({
    extensions,
    content: initialHtml,
    editorProps: {
      attributes: {
        class: "document-editor-prosemirror"
      },
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;
        for (const item of Array.from(items)) {
          if (item.type.startsWith("image/")) {
            event.preventDefault();
            const file = item.getAsFile();
            if (!file) return false;
            void resolveImageSrc(file).then((src) => {
              if (!src) return;
                view.dispatch(
                  view.state.tr.replaceSelectionWith(
                    view.state.schema.nodes.image.create({ src })
                  )
                );
            }).catch(() => undefined);
            return true;
          }
        }
        return false;
      },
      handleDrop: (view, event) => {
        const files = event.dataTransfer?.files;
        if (!files?.length) return false;
        for (const file of Array.from(files)) {
          if (file.type.startsWith("image/")) {
            event.preventDefault();
            void resolveImageSrc(file).then((src) => {
              if (!src) return;
                const pos = view.posAtCoords({ left: event.clientX, top: event.clientY });
                if (pos) {
                  view.dispatch(
                    view.state.tr.insert(
                      pos.pos,
                      view.state.schema.nodes.image.create({ src })
                    )
                  );
                }
            }).catch(() => undefined);
            return true;
          }
        }
        return false;
      }
    },
    onCreate: ({ editor: nextEditor }) => {
      editorRef.current = nextEditor;
      loadedDocumentIdRef.current = documentId;
      onHeadingsChange(syncHeadingIds(nextEditor, documentId));
      clearAutoSaveTimer();
      latestHtmlRef.current = nextEditor.getHTML();
      lastSavedHtmlRef.current = nextEditor.getHTML();
      setIsDirty(false);
      setAutoSaveStatus("saved");
    },
    onUpdate: ({ editor: nextEditor }) => {
      latestHtmlRef.current = nextEditor.getHTML();
      setIsDirty(true);
      setAutoSaveStatus("dirty");
      onHeadingsChange(syncHeadingIds(nextEditor, documentId));
      scheduleAutoSave();
    },
    onSelectionUpdate: () => {
      setSelectionKey((prev) => prev + 1);
    }
  }, [documentId, resolveImageSrc]);

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    if (loadedDocumentIdRef.current === documentId) return;
    clearAutoSaveTimer();
    editor.commands.setContent(initialHtml || "", { emitUpdate: false });
    loadedDocumentIdRef.current = documentId;
    onHeadingsChange(syncHeadingIds(editor, documentId));
    clearAutoSaveTimer();
    latestHtmlRef.current = editor.getHTML();
    lastSavedHtmlRef.current = editor.getHTML();
    setIsDirty(false);
    setAutoSaveStatus("saved");
  }, [clearAutoSaveTimer, documentId, editor, initialHtml, onHeadingsChange]);

  useEffect(() => {
    return () => clearAutoSaveTimer();
  }, [clearAutoSaveTimer]);

  // Close color picker on click outside
  useEffect(() => {
    if (!openColorPicker) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setOpenColorPicker(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openColorPicker]);

  // Close block picker on click outside
  useEffect(() => {
    if (!isBlockPickerOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (blockPickerRef.current && !blockPickerRef.current.contains(e.target as Node)) {
        setIsBlockPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isBlockPickerOpen]);

  // Close font size picker on click outside
  useEffect(() => {
    if (!isFontSizeOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (fontSizeRef.current && !fontSizeRef.current.contains(e.target as Node)) {
        setIsFontSizeOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isFontSizeOpen]);

  // Close font family picker on click outside
  useEffect(() => {
    if (!isFontFamilyOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (fontFamilyRef.current && !fontFamilyRef.current.contains(e.target as Node)) {
        setIsFontFamilyOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isFontFamilyOpen]);

  // Reset font search when dropdown closes
  useEffect(() => {
    if (!isFontFamilyOpen) setFontFamilySearch("");
  }, [isFontFamilyOpen]);

  const toggleColorPicker = useCallback((type: "text" | "highlight") => {
    setOpenColorPicker((prev) => (prev === type ? null : type));
  }, []);

  if (!editor) {
    return <div className="document-editor-loading">Đang mở trình soạn thảo...</div>;
  }

  const run = (callback: (editor: Editor) => void) => {
    callback(editor);
    onHeadingsChange(syncHeadingIds(editor, documentId));
  };

  const setLink = () => {
    const previousUrl = editor.getAttributes("link").href as string | undefined;
    setLinkUrl(previousUrl ?? "");
    setIsLinkDialogOpen(true);
  };

  const submitLink = () => {
    if (!linkUrl.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      setIsLinkDialogOpen(false);
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: linkUrl.trim() }).run();
    setIsDirty(true);
    setIsLinkDialogOpen(false);
  };

  const addImage = () => {
    setImageUrl("");
    setIsImageDialogOpen(true);
  };

  const submitImageUrl = () => {
    if (!imageUrl.trim()) return;
    editor.chain().focus().setImage({ src: imageUrl.trim() }).run();
    setIsDirty(true);
    setIsImageDialogOpen(false);
  };

  const uploadPickedImage = async (file?: File | null) => {
    if (!file) return;
    const src = await resolveImageSrc(file);
    if (src) {
      editor.chain().focus().setImage({ src }).run();
      setIsDirty(true);
    }
  };

  const closeEditor = async () => {
    if (isSaving || isUploadingImage || saveInFlightRef.current) return;
    latestHtmlRef.current = editor.getHTML();
    if (latestHtmlRef.current !== lastSavedHtmlRef.current) {
      await saveLatest().catch(() => undefined);
      if (latestHtmlRef.current !== lastSavedHtmlRef.current) return;
    }
    onCancel();
  };

  const isInTable = editor.isActive("table");
  const isAutoSaveSettled = !isUploadingImage && !isSaving && !isDirty && autoSaveStatus === "saved";
  const statusLabel = isAutoSaveSettled ? "Đã lưu" : "Đang lưu...";

  return (
    <div className="document-editor-shell">
      <div className="document-editor-toolbar" role="toolbar" aria-label="Công cụ soạn tài liệu">
        {/* 1. Undo / Redo */}
        <div className="editor-tool-group">
          <button type="button" title="Hoàn tác" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>
            <Undo2 size={15} />
          </button>
          <button type="button" title="Làm lại" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>
            <Redo2 size={15} />
          </button>
        </div>

        <span className="editor-separator" />

        {/* 2. Block Type */}
        <div className="editor-tool-group" ref={blockPickerRef}>
          <div className="editor-block-dropdown-wrapper">
            <button
              type="button"
              className={`editor-block-trigger${isBlockPickerOpen ? " open" : ""}`}
              onClick={() => setIsBlockPickerOpen((prev) => !prev)}
              title="Kiểu đoạn"
            >
              {currentBlock(editor) === "h1" && <Heading1 size={14} />}
              {currentBlock(editor) === "h2" && <Heading2 size={14} />}
              {currentBlock(editor) === "h3" && <Heading3 size={14} />}
              {currentBlock(editor) === "paragraph" && <Pilcrow size={14} />}
              <span className="editor-block-label">
                {{ paragraph: "Paragraph", h1: "Heading 1", h2: "Heading 2", h3: "Heading 3" }[currentBlock(editor)]}
              </span>
              <ChevronDown size={11} className={`editor-block-chevron${isBlockPickerOpen ? " open" : ""}`} />
            </button>
            {isBlockPickerOpen && (
              <div className="editor-block-popover">
                {([
                  { value: "paragraph", label: "Paragraph", icon: <Pilcrow size={15} /> },
                  { value: "h1", label: "Heading 1", icon: <Heading1 size={16} /> },
                  { value: "h2", label: "Heading 2", icon: <Heading2 size={16} /> },
                  { value: "h3", label: "Heading 3", icon: <Heading3 size={16} /> }
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`editor-block-option${currentBlock(editor) === opt.value ? " active" : ""}`}
                    onClick={() => {
                      run((activeEditor) => {
                        if (opt.value === "paragraph") activeEditor.chain().focus().setParagraph().run();
                        if (opt.value === "h1") activeEditor.chain().focus().toggleHeading({ level: 1 }).run();
                        if (opt.value === "h2") activeEditor.chain().focus().toggleHeading({ level: 2 }).run();
                        if (opt.value === "h3") activeEditor.chain().focus().toggleHeading({ level: 3 }).run();
                      });
                      setIsBlockPickerOpen(false);
                    }}
                  >
                    <span className="editor-block-option-icon">{opt.icon}</span>
                    <span className="editor-block-option-label">{opt.label}</span>
                    {currentBlock(editor) === opt.value && <Check size={14} className="editor-block-check" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <span className="editor-separator" />

        {/* 3. Font Family + Font Size (typography group, no separator between them) */}
        <div className="editor-tool-group" ref={fontFamilyRef}>
          <div className="editor-block-dropdown-wrapper">
            <button
              type="button"
              className={`editor-block-trigger editor-fontfamily-trigger${isFontFamilyOpen ? " open" : ""}`}
              onClick={() => setIsFontFamilyOpen((prev) => !prev)}
              title="Phông chữ"
            >
              <span className="editor-block-label" style={{ fontFamily: (editor.getAttributes("textStyle").fontFamily as string) || "inherit" }}>
                {FONT_FAMILIES.find((f) => f.value === (editor.getAttributes("textStyle").fontFamily || ""))?.label || "Inter"}
              </span>
              <ChevronDown size={11} className={`editor-block-chevron${isFontFamilyOpen ? " open" : ""}`} />
            </button>
            {isFontFamilyOpen && (
              <div className="editor-block-popover editor-fontfamily-popover">
                <div className="editor-fontfamily-search-row">
                  <input
                    type="text"
                    className="editor-fontfamily-search"
                    placeholder="Tìm font..."
                    autoFocus
                    value={fontFamilySearch}
                    onChange={(e) => setFontFamilySearch(e.target.value)}
                  />
                </div>
                <div className="editor-fontfamily-list">
                  {FONT_FAMILIES
                    .filter((f) => f.label.toLowerCase().includes(fontFamilySearch.toLowerCase()))
                    .map((font) => {
                      const currentFont = (editor.getAttributes("textStyle").fontFamily as string) || "";
                      const isActive = currentFont === font.value;
                      return (
                        <button
                          key={font.label}
                          type="button"
                          className={`editor-block-option${isActive ? " active" : ""}`}
                          style={{ fontFamily: font.value || "inherit" }}
                          onClick={() => {
                            if (font.value) {
                              editor.chain().focus().setMark("textStyle", { fontFamily: font.value }).run();
                            } else {
                              editor.chain().focus().unsetMark("textStyle").run();
                            }
                            setIsFontFamilyOpen(false);
                          }}
                        >
                          <span className="editor-block-option-label">{font.label}</span>
                          {isActive && <Check size={14} className="editor-block-check" />}
                        </button>
                      );
                    })}
                  {FONT_FAMILIES.filter((f) => f.label.toLowerCase().includes(fontFamilySearch.toLowerCase())).length === 0 && (
                    <div className="editor-fontfamily-empty">Không tìm thấy</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="editor-tool-group" ref={fontSizeRef}>
          <div className="editor-block-dropdown-wrapper">
            <button
              type="button"
              className={`editor-block-trigger editor-fontsize-trigger${isFontSizeOpen ? " open" : ""}`}
              onClick={() => setIsFontSizeOpen((prev) => !prev)}
              title="Cỡ chữ"
            >
              <ALargeSmall size={15} />
              <span className="editor-block-label">
                {(editor.getAttributes("textStyle").fontSize as string) || ({ sm: "15", md: "17", lg: "19" }[fontSize] ?? "16")}px
              </span>
              <ChevronDown size={11} className={`editor-block-chevron${isFontSizeOpen ? " open" : ""}`} />
            </button>
            {isFontSizeOpen && (
              <div className="editor-block-popover editor-fontsize-popover">
                <div className="editor-fontsize-input-row">
                  <input
                    type="number"
                    className="editor-fontsize-input"
                    placeholder="Nhập cỡ"
                    min={1}
                    max={200}
                    defaultValue={(editor.getAttributes("textStyle").fontSize as string) || ""}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const val = (e.target as HTMLInputElement).value.trim();
                        if (val && Number(val) >= 1 && Number(val) <= 200) {
                          editor.chain().focus().setMark("textStyle", { fontSize: val }).run();
                        }
                        setIsFontSizeOpen(false);
                      }
                    }}
                  />
                  <span className="editor-fontsize-unit">px</span>
                </div>
                <div className="editor-fontsize-divider" />
                <button
                  type="button"
                  className={`editor-block-option${!editor.getAttributes("textStyle").fontSize ? " active" : ""}`}
                  onClick={() => {
                    editor.chain().focus().unsetMark("textStyle").run();
                    setIsFontSizeOpen(false);
                  }}
                >
                  <span className="editor-block-option-label">Mặc định</span>
                  {!editor.getAttributes("textStyle").fontSize && <Check size={14} className="editor-block-check" />}
                </button>
                {FONT_SIZES.map((size) => (
                  <button
                    key={size}
                    type="button"
                    className={`editor-block-option${editor.getAttributes("textStyle").fontSize === size ? " active" : ""}`}
                    onClick={() => {
                      editor.chain().focus().setMark("textStyle", { fontSize: size }).run();
                      setIsFontSizeOpen(false);
                    }}
                  >
                    <span className="editor-fontsize-preview" style={{ fontSize: `${Math.min(Number(size), 20)}px` }}>{size}px</span>
                    {editor.getAttributes("textStyle").fontSize === size && <Check size={14} className="editor-block-check" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <span className="editor-separator" />

        {/* 4. Text Appearance: B I U + Color + Highlight */}
        <div className="editor-tool-group">
          <button type="button" title="In đậm" className={editor.isActive("bold") ? "active" : ""} onClick={() => editor.chain().focus().toggleBold().run()}>
            <Bold size={15} />
          </button>
          <button type="button" title="In nghiêng" className={editor.isActive("italic") ? "active" : ""} onClick={() => editor.chain().focus().toggleItalic().run()}>
            <Italic size={15} />
          </button>
          <button type="button" title="Gạch chân" className={editor.isActive("underline") ? "active" : ""} onClick={() => editor.chain().focus().toggleUnderline().run()}>
            <UnderlineIcon size={15} />
          </button>
        </div>
        <div className="editor-tool-group" ref={colorPickerRef}>
          <div className="editor-color-dropdown-wrapper">
            <button
              type="button"
              title="Màu chữ"
              className={`editor-color-trigger${openColorPicker === "text" ? " open" : ""}`}
              onClick={() => toggleColorPicker("text")}
            >
              <Type size={15} />
              <ChevronDown size={10} className="editor-color-chevron" />
            </button>
            {openColorPicker === "text" && (
              <div className="editor-color-popover">
                <div className="editor-color-popover-label">Màu chữ</div>
                <div className="editor-color-grid">
                  {TEXT_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className="editor-swatch"
                      title={`Màu chữ ${color}`}
                      style={{ "--swatch-color": color } as CSSProperties}
                      onClick={() => {
                        editor.chain().focus().setColor(color).run();
                        setOpenColorPicker(null);
                      }}
                    />
                  ))}
                </div>
                <button type="button" className="editor-color-reset" onClick={() => { editor.chain().focus().unsetColor().run(); setOpenColorPicker(null); }}>
                  <X size={12} /> Xóa màu
                </button>
              </div>
            )}
          </div>
          <div className="editor-color-dropdown-wrapper">
            <button
              type="button"
              title="Bôi màu nền"
              className={`editor-color-trigger${openColorPicker === "highlight" ? " open" : ""}`}
              onClick={() => toggleColorPicker("highlight")}
            >
              <Highlighter size={15} />
              <ChevronDown size={10} className="editor-color-chevron" />
            </button>
            {openColorPicker === "highlight" && (
              <div className="editor-color-popover">
                <div className="editor-color-popover-label">Bôi màu nền</div>
                <div className="editor-color-grid">
                  {HIGHLIGHT_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className="editor-swatch"
                      title={`Bôi màu ${color}`}
                      style={{ "--swatch-color": color } as CSSProperties}
                      onClick={() => {
                        editor.chain().focus().setHighlight({ color }).run();
                        setOpenColorPicker(null);
                      }}
                    />
                  ))}
                </div>
                <button type="button" className="editor-color-reset" onClick={() => { editor.chain().focus().unsetHighlight().run(); setOpenColorPicker(null); }}>
                  <X size={12} /> Xóa bôi màu
                </button>
              </div>
            )}
          </div>
        </div>

        <span className="editor-separator" />

        {/* 5. Alignment */}
        <div className="editor-tool-group">
          <button type="button" title="Căn trái" className={editor.isActive({ textAlign: "left" }) ? "active" : ""} onClick={() => editor.chain().focus().setTextAlign("left").run()}>
            <AlignLeft size={15} />
          </button>
          <button type="button" title="Căn giữa" className={editor.isActive({ textAlign: "center" }) ? "active" : ""} onClick={() => editor.chain().focus().setTextAlign("center").run()}>
            <AlignCenter size={15} />
          </button>
          <button type="button" title="Căn phải" className={editor.isActive({ textAlign: "right" }) ? "active" : ""} onClick={() => editor.chain().focus().setTextAlign("right").run()}>
            <AlignRight size={15} />
          </button>
          <button type="button" title="Căn đều hai bên" className={editor.isActive({ textAlign: "justify" }) ? "active" : ""} onClick={() => editor.chain().focus().setTextAlign("justify").run()}>
            <AlignJustify size={15} />
          </button>
        </div>

        <span className="editor-separator" />

        {/* 6. Structure & Insert: Lists, Quote, Link, Image, Table */}
        <div className="editor-tool-group">
          <button type="button" title="Danh sách bullet" className={editor.isActive("bulletList") ? "active" : ""} onClick={() => editor.chain().focus().toggleBulletList().run()}>
            <List size={15} />
          </button>
          <button type="button" title="Danh sách số" className={editor.isActive("orderedList") ? "active" : ""} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
            <ListOrdered size={15} />
          </button>
          <button type="button" title="Trích dẫn" className={editor.isActive("blockquote") ? "active" : ""} onClick={() => editor.commands.toggleWrap("blockquote")}>
            <Quote size={15} />
          </button>
          <button type="button" title="Liên kết" className={editor.isActive("link") ? "active" : ""} onClick={setLink}>
            <LinkIcon size={15} />
          </button>
          <button type="button" title="Chèn ảnh bằng URL" onClick={addImage}>
            <ImagePlus size={15} />
          </button>
          <button type="button" title="Upload ảnh" disabled={isUploadingImage} onClick={() => imageInputRef.current?.click()}>
            <ImagePlus size={15} />
            <AArrowUp size={10} />
          </button>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              void uploadPickedImage(file).catch(() => undefined);
            }}
          />
          <button type="button" title="Chèn bảng 3 x 3" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
            <Table2 size={15} />
          </button>
          {isInTable && (
            <>
              <button type="button" title="Thêm dòng dưới" onClick={() => editor.chain().focus().addRowAfter().run()}>
                <Rows3 size={14} />
              </button>
              <button type="button" title="Xóa dòng đang chọn" onClick={() => editor.chain().focus().deleteRow().run()}>
                <Rows3 size={14} />
                <Trash2 size={10} />
              </button>
              <button type="button" title="Thêm cột bên phải" onClick={() => editor.chain().focus().addColumnAfter().run()}>
                <Columns3 size={14} />
              </button>
              <button type="button" title="Xóa cột đang chọn" onClick={() => editor.chain().focus().deleteColumn().run()}>
                <Columns3 size={14} />
                <Trash2 size={10} />
              </button>
              <button type="button" title="Toggle header row" onClick={() => editor.chain().focus().toggleHeaderRow().run()}>
                <Palette size={14} />
              </button>
              <button type="button" title="Xóa bảng" className="editor-danger-btn" onClick={() => editor.chain().focus().deleteTable().run()}>
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>

        {/* Spacer to push autosave group right */}
        <div className="editor-toolbar-spacer" />

        {/* 7. Autosave status */}
        <div className="editor-save-group">
          {imageUploadError && <span className="editor-save-status dirty">{imageUploadError}</span>}
          <span className={`editor-save-status ${isAutoSaveSettled ? "" : "dirty"}`}>
            <span className={`save-status-dot ${isAutoSaveSettled ? "saved" : "dirty"}`} />
            {statusLabel}
          </span>
          <button
            type="button"
            className="editor-cancel-btn"
            disabled={isSaving || isUploadingImage || autoSaveStatus === "saving"}
            onClick={() => void closeEditor()}
          >
            <X size={14} /> Đóng
          </button>
        </div>
      </div>

      <div ref={contentRef} className={`html-document document-editor-surface font-${fontSize}`}>
        <EditorContent editor={editor} />
      </div>

      {isLinkDialogOpen && (
        <div className="editor-confirm-overlay" onClick={() => setIsLinkDialogOpen(false)}>
          <div className="editor-confirm-dialog editor-input-dialog" onClick={(event) => event.stopPropagation()}>
            <h3 className="editor-confirm-title">Chèn liên kết</h3>
            <input
              className="editor-dialog-input"
              value={linkUrl}
              autoFocus
              placeholder="https://..."
              onChange={(event) => setLinkUrl(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") submitLink();
              }}
            />
            <div className="editor-confirm-actions">
              <button type="button" className="editor-confirm-cancel" onClick={() => setIsLinkDialogOpen(false)}>Hủy</button>
              <button type="button" className="editor-confirm-btn editor-confirm-btn--primary" onClick={submitLink}>Áp dụng</button>
            </div>
          </div>
        </div>
      )}

      {isImageDialogOpen && (
        <div className="editor-confirm-overlay" onClick={() => setIsImageDialogOpen(false)}>
          <div className="editor-confirm-dialog editor-input-dialog" onClick={(event) => event.stopPropagation()}>
            <h3 className="editor-confirm-title">Chèn ảnh bằng URL</h3>
            <input
              className="editor-dialog-input"
              value={imageUrl}
              autoFocus
              placeholder="https://..."
              onChange={(event) => setImageUrl(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") submitImageUrl();
              }}
            />
            <div className="editor-confirm-actions">
              <button type="button" className="editor-confirm-cancel" onClick={() => setIsImageDialogOpen(false)}>Hủy</button>
              <button type="button" className="editor-confirm-btn editor-confirm-btn--primary" onClick={submitImageUrl}>Chèn ảnh</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
