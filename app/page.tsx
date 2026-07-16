"use client";

import { useEffect, useRef, useState } from "react";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

type Section = {
  id: string;
  title: string;
  content: string;
  titleSize?: number;
  contentSize?: number;
  titleColor?: string;
  contentColor?: string;
};
type ResumePage = { id: string; sections: Section[] };

type EditorSnapshot = {
  pages: ResumePage[];
  activePage: number;
  profile: { name: string; role: string; contact: string; keywords: string };
  profileStyles: Record<"role" | "contact" | "keywords", { size: number; color: string; visible: boolean }>;
  photo: string;
  settings: { fontSize: number; lineHeight: number; sectionGap: number; fontFamily: string; accent: string; photoShape: "square" | "round"; photoSize: { width: number; height: number } };
};

const makeId = () => Math.random().toString(36).slice(2, 9);

function parseResumeSections(text: string): Section[] {
  const headingPattern = /^(个人简介|自我评价|核心优势|求职意向|工作经历|实习经历|项目经历|教育经历|学历信息|专业技能|技能特长|证书|获奖经历|校园经历|语言能力|联系方式)[：:]?$/;
  const lines = text.split(/\r?\n/).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
  const sections: Section[] = [];
  let current: Section = { id: makeId(), title: "PDF 导入内容", content: "" };
  for (const line of lines) {
    const heading = line.match(headingPattern)?.[1];
    if (heading) {
      if (current.content.trim()) sections.push(current);
      current = { id: makeId(), title: heading, content: "" };
    } else {
      current.content += `${current.content ? "\n" : ""}${line}`;
    }
  }
  if (current.content.trim()) sections.push(current);
  return sections.length ? sections : [{ id: makeId(), title: "PDF 导入内容", content: text.trim() }];
}

function splitRichHtml(html: string, ratio = 0.62) {
  const source = document.createElement("div");
  source.innerHTML = html;
  const textLength = source.textContent?.length ?? 0;
  if (textLength < 2) return null;
  const splitAt = Math.max(1, Math.min(textLength - 1, Math.round(textLength * ratio)));
  const walker = document.createTreeWalker(source, NodeFilter.SHOW_TEXT);
  let traversed = 0;
  let node = walker.nextNode();
  while (node) {
    const length = node.textContent?.length ?? 0;
    if (traversed + length >= splitAt) {
      const offset = splitAt - traversed;
      const firstRange = document.createRange();
      firstRange.selectNodeContents(source);
      firstRange.setEnd(node, offset);
      const secondRange = document.createRange();
      secondRange.selectNodeContents(source);
      secondRange.setStart(node, offset);
      const first = document.createElement("div");
      const second = document.createElement("div");
      first.append(firstRange.cloneContents());
      second.append(secondRange.cloneContents());
      return [first.innerHTML, second.innerHTML] as const;
    }
    traversed += length;
    node = walker.nextNode();
  }
  return null;
}

function richTextToPlainText(html: string) {
  const element = document.createElement("div");
  element.innerHTML = html;
  return element.innerText;
}

const initialPages: ResumePage[] = [
  {
    id: "page-1",
    sections: [
      {
        id: "profile",
        title: "个人简介",
        content:
          "5 年互联网产品经验，关注用户体验与业务增长。擅长从用户洞察出发拆解复杂问题，推动产品、设计和研发团队高效协作。",
      },
      {
        id: "experience",
        title: "工作经历",
        content:
          "杭州未来科技有限公司｜高级产品经理　　　　　　　　　2022.06 — 至今\n负责核心产品的规划与迭代，通过用户调研和数据分析识别关键机会，推动新功能从方案到上线。\n• 重构关键业务流程，核心转化率提升 18%，用户操作时长降低 25%\n• 建立跨部门项目机制，版本准时交付率由 72% 提升至 95%\n\n上海新锐网络有限公司｜产品经理　　　　　　　　　　　2020.07 — 2022.05\n负责增长产品与运营工具，持续优化拉新、激活和留存链路。",
      },
      {
        id: "education",
        title: "教育经历",
        content:
          "浙江大学｜工业设计｜本科　　　　　　　　　　　　　　2016.09 — 2020.06\n主修用户研究、交互设计、产品创新；校级优秀毕业设计。",
      },
      {
        id: "skills",
        title: "专业技能",
        content:
          "产品策略　用户研究　数据分析　项目管理　Axure　Figma　SQL",
      },
    ],
  },
];

function Editable({
  value,
  onChange,
  className = "",
  multiline = false,
  style,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  multiline?: boolean;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) ref.current.innerHTML = value;
  }, [value]);

  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      className={`editable ${className}`}
      style={style}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline={multiline}
      onInput={(event) => onChange(event.currentTarget.innerHTML)}
      onPaste={(event) => {
        event.preventDefault();
        const plainText = event.clipboardData.getData("text/plain");
        document.execCommand("insertText", false, plainText);
      }}
      onKeyDown={(event) => {
        if (!multiline && event.key === "Enter") event.preventDefault();
      }}
    />
  );
}

function PhotoEditor({
  photo,
  shape,
  width,
  height,
  onPhoto,
  onResize,
}: {
  photo: string;
  shape: "square" | "round";
  width: number;
  height: number;
  onPhoto: (file?: File) => void;
  onResize: (width: number, height: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !photo) return;
    canvas.dataset.ready = "false";
    const image = new Image();
    image.onload = () => {
      const scale = 3;
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      const context = canvas.getContext("2d");
      if (!context) return;
      const coverScale = Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
      const sourceWidth = canvas.width / coverScale;
      const sourceHeight = canvas.height / coverScale;
      const sourceX = (image.naturalWidth - sourceWidth) / 2;
      const sourceY = (image.naturalHeight - sourceHeight) / 2;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
      canvas.dataset.ready = "true";
      window.dispatchEvent(new Event("resume-photo-ready"));
    };
    image.src = photo;
    return () => { image.onload = null; };
  }, [height, photo, width]);

  const startResize = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startY = event.clientY;
    const startWidth = width;
    const startHeight = height;
    const move = (moveEvent: PointerEvent) => {
      onResize(
        Math.min(220, Math.max(72, startWidth + moveEvent.clientX - startX)),
        Math.min(260, Math.max(72, startHeight + moveEvent.clientY - startY)),
      );
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop, { once: true });
  };

  return (
    <div
      className={`resume-photo ${shape}`}
      style={{ width, height, flexBasis: width }}
      title="拖动右下角可缩放照片"
    >
      <label className="photo-picker">
        {photo ? <canvas ref={canvasRef} aria-label="个人照片" /> : <><span>＋</span><small>添加照片</small></>}
        <input type="file" accept="image/*" onChange={(event) => onPhoto(event.target.files?.[0])} />
      </label>
      <button type="button" className="photo-resize-hint" aria-label="拖动缩放照片" onPointerDown={startResize} />
    </div>
  );
}

export default function Home() {
  const [pages, setPages] = useState<ResumePage[]>(initialPages);
  const [activePage, setActivePage] = useState(0);
  const [fontSize, setFontSize] = useState(12.5);
  const [lineHeight, setLineHeight] = useState(1.65);
  const [sectionGap, setSectionGap] = useState(20);
  const [fontFamily, setFontFamily] = useState("sans");
  const [accent, setAccent] = useState("#246b5b");
  const [photo, setPhoto] = useState<string>("");
  const [photoShape, setPhotoShape] = useState<"square" | "round">("square");
  const [photoSize, setPhotoSize] = useState({ width: 102, height: 128 });
  const [showTips, setShowTips] = useState(true);
  const [isImportingPdf, setIsImportingPdf] = useState(false);
  const [pageNotice, setPageNotice] = useState("");
  const [canUndo, setCanUndo] = useState(false);
  const historyRef = useRef<string[]>([]);
  const isUndoingRef = useRef(false);
  const noticeTimerRef = useRef<number | null>(null);
  const [profileStyles, setProfileStyles] = useState({
    role: { size: 10.5, color: "#246b5b", visible: true },
    contact: { size: 10.5, color: "#246b5b", visible: true },
    keywords: { size: 10.5, color: "#246b5b", visible: true },
  });
  const [profile, setProfile] = useState({
    name: "林知夏",
    role: "高级产品经理",
    contact: "138 0000 0000　 hello@example.com　 杭州",
    keywords: "AI 产品 0-1｜CRM 工作流｜本地生活工具｜视频 AIGC｜复杂 Agent",
  });

  useEffect(() => {
    const saved = window.localStorage.getItem("resume-studio-draft");
    if (!saved) return;
    try {
      const data = JSON.parse(saved);
      // Restoring a client-only draft necessarily hydrates component state after mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (data.pages?.length) setPages(data.pages);
      if (data.profile) setProfile(data.profile);
      if (data.profileStyles) setProfileStyles(data.profileStyles);
      if (data.settings) {
        setFontSize(data.settings.fontSize ?? 12.5);
        setLineHeight(data.settings.lineHeight ?? 1.65);
        setSectionGap(data.settings.sectionGap ?? 20);
        setFontFamily(data.settings.fontFamily ?? "sans");
        setAccent(data.settings.accent ?? "#246b5b");
        setPhotoShape(data.settings.photoShape ?? "square");
        setPhotoSize(data.settings.photoSize ?? { width: 102, height: 128 });
      }
      if (data.photo) setPhoto(data.photo);
    } catch {
      window.localStorage.removeItem("resume-studio-draft");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(
          "resume-studio-draft",
          JSON.stringify({
            pages,
            profile,
            profileStyles,
            photo,
            settings: { fontSize, lineHeight, sectionGap, fontFamily, accent, photoShape, photoSize },
          }),
        );
      } catch {
        // Large photos may exceed local storage; editing still works for this session.
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [pages, profile, profileStyles, photo, fontSize, lineHeight, sectionGap, fontFamily, accent, photoShape, photoSize]);

  const editorSnapshot = JSON.stringify({
    pages,
    activePage,
    profile,
    profileStyles,
    photo,
    settings: { fontSize, lineHeight, sectionGap, fontFamily, accent, photoShape, photoSize },
  } satisfies EditorSnapshot);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (isUndoingRef.current) {
        isUndoingRef.current = false;
        return;
      }
      const history = historyRef.current;
      if (history[history.length - 1] === editorSnapshot) return;
      history.push(editorSnapshot);
      if (history.length > 40) history.shift();
      setCanUndo(history.length > 1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [editorSnapshot]);

  const applySnapshot = (snapshot: EditorSnapshot) => {
    setPages(snapshot.pages);
    setActivePage(Math.min(snapshot.activePage, snapshot.pages.length - 1));
    setProfile(snapshot.profile);
    setProfileStyles(snapshot.profileStyles);
    setPhoto(snapshot.photo);
    setFontSize(snapshot.settings.fontSize);
    setLineHeight(snapshot.settings.lineHeight);
    setSectionGap(snapshot.settings.sectionGap);
    setFontFamily(snapshot.settings.fontFamily);
    setAccent(snapshot.settings.accent);
    setPhotoShape(snapshot.settings.photoShape);
    setPhotoSize(snapshot.settings.photoSize);
  };

  const undo = () => {
    if (historyRef.current.length < 2) return;
    historyRef.current.pop();
    const previous = historyRef.current[historyRef.current.length - 1];
    isUndoingRef.current = true;
    applySnapshot(JSON.parse(previous) as EditorSnapshot);
    setCanUndo(historyRef.current.length > 1);
  };

  const updateSection = (pageIndex: number, sectionId: string, patch: Partial<Section>) => {
    setPages((current) =>
      current.map((page, index) =>
        index === pageIndex
          ? { ...page, sections: page.sections.map((section) => (section.id === sectionId ? { ...section, ...patch } : section)) }
          : page,
      ),
    );
  };

  const addSection = () => {
    const id = makeId();
    setPages((current) =>
      current.map((page, index) =>
        index === activePage
          ? { ...page, sections: [...page.sections, { id, title: "新模块", content: "点击这里输入内容……", titleSize: 15, contentSize: fontSize, titleColor: "#17201d", contentColor: "#343d3a" }] }
          : page,
      ),
    );
  };

  const moveSection = (sectionIndex: number, direction: -1 | 1) => {
    setPages((current) =>
      current.map((page, index) => {
        if (index !== activePage) return page;
        const next = [...page.sections];
        const target = sectionIndex + direction;
        if (target < 0 || target >= next.length) return page;
        [next[sectionIndex], next[target]] = [next[target], next[sectionIndex]];
        return { ...page, sections: next };
      }),
    );
  };

  const movePage = (direction: -1 | 1) => {
    const target = activePage + direction;
    if (target < 0 || target >= pages.length) return;
    setPages((current) => {
      const next = [...current];
      [next[activePage], next[target]] = [next[target], next[activePage]];
      return next;
    });
    setActivePage(target);
  };

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const pageElements = Array.from(document.querySelectorAll<HTMLElement>(".resume-page"));
      const overflowIndex = pageElements.findIndex((page) => page.scrollHeight > page.clientHeight + 2);
      if (overflowIndex < 0) return;

      setPageNotice(`第 ${overflowIndex + 1} 页空间不足，超出内容已自动移到下一页`);
      if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = window.setTimeout(() => setPageNotice(""), 3200);

      setPages((current) => {
        const sourcePage = current[overflowIndex];
        if (!sourcePage?.sections.length) return current;
        const next = current.map((page) => ({ ...page, sections: [...page.sections] }));
        const source = next[overflowIndex];
        const last = source.sections[source.sections.length - 1];
        let carried: Section;

        if (source.sections.length > 1) {
          carried = source.sections.pop()!;
        } else {
          const split = splitRichHtml(last.content);
          if (!split) return current;
          source.sections[0] = { ...last, content: split[0] };
          carried = { ...last, id: makeId(), title: `${last.title.replace(/（续）$/, "")}（续）`, content: split[1] };
        }

        if (!next[overflowIndex + 1]) next.push({ id: `page-${makeId()}`, sections: [] });
        next[overflowIndex + 1].sections.unshift(carried);
        return next;
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pages, fontSize, lineHeight, sectionGap, fontFamily, photoSize, profile, profileStyles]);

  const removeSection = (sectionId: string) => {
    setPages((current) => current.map((page, index) => index === activePage ? { ...page, sections: page.sections.filter((section) => section.id !== sectionId) } : page));
  };

  const addPage = () => {
    setPages((current) => [...current, { id: `page-${makeId()}`, sections: [{ id: makeId(), title: "补充经历", content: "点击这里继续编写简历内容……" }] }]);
    setActivePage(pages.length);
  };

  const duplicatePage = () => {
    const source = pages[activePage];
    const clone = { id: `page-${makeId()}`, sections: source.sections.map((section) => ({ ...section, id: makeId() })) };
    setPages((current) => [...current.slice(0, activePage + 1), clone, ...current.slice(activePage + 1)]);
    setActivePage(activePage + 1);
  };

  const deletePage = () => {
    if (pages.length === 1) return;
    const deletedIndex = activePage;
    setPages((current) => {
      const next = current.filter((_, index) => index !== deletedIndex);
      setActivePage(Math.min(deletedIndex, next.length - 1));
      return next;
    });
  };

  const handlePhoto = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto(String(reader.result));
    reader.readAsDataURL(file);
  };

  const handlePdfImport = async (file?: File) => {
    if (!file) return;
    if (!window.confirm("导入 PDF 会替换当前简历正文，确定继续吗？你可以使用撤回恢复。")) return;
    setIsImportingPdf(true);
    try {
      const data = new Uint8Array(await file.arrayBuffer());
      const document = await getDocument({ data }).promise;
      const pageTexts: string[] = [];
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
        const page = await document.getPage(pageNumber);
        const content = await page.getTextContent();
        let pageText = "";
        for (const item of content.items) {
          if (!("str" in item)) continue;
          pageText += `${item.str}${item.hasEOL ? "\n" : " "}`;
        }
        if (pageText.trim()) pageTexts.push(pageText.trim());
      }
      const fullText = pageTexts.join("\n");
      if (!fullText.trim()) {
        window.alert("没有识别到可复制文字。该 PDF 可能是扫描图片版，暂时不支持 OCR，请先转换为可搜索 PDF。 ");
        return;
      }
      setPages([{ id: `page-${makeId()}`, sections: parseResumeSections(fullText) }]);
      setActivePage(0);
      setPageNotice(`已从 PDF 识别 ${document.numPages} 页文字，并按简历模块导入`);
      if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = window.setTimeout(() => setPageNotice(""), 4200);
    } catch {
      window.alert("PDF 读取失败，请确认文件未加密且可以正常打开。");
    } finally {
      setIsImportingPdf(false);
    }
  };

  const exportWord = async () => {
    const { Document, HeadingLevel, ImageRun, Packer, PageBreak, Paragraph, TextRun } = await import("docx");
    const children: InstanceType<typeof Paragraph>[] = [
      new Paragraph({ text: richTextToPlainText(profile.name), heading: HeadingLevel.TITLE }),
      new Paragraph({ children: [new TextRun({ text: richTextToPlainText(profile.role), bold: true, color: accent.replace("#", "") })] }),
      new Paragraph({ text: richTextToPlainText(profile.contact) }),
      new Paragraph({ text: `关键词：${richTextToPlainText(profile.keywords)}` }),
    ];

    if (photo) {
      const photoBytes = new Uint8Array(await (await fetch(photo)).arrayBuffer());
      children.splice(1, 0, new Paragraph({
        children: [new ImageRun({
          data: photoBytes,
          type: photo.startsWith("data:image/png") ? "png" : "jpg",
          transformation: { width: Math.round(photoSize.width), height: Math.round(photoSize.height) },
        })],
      }));
    }

    pages.forEach((page, pageIndex) => {
      if (pageIndex > 0) children.push(new Paragraph({ children: [new PageBreak()] }));
      page.sections.forEach((section) => {
        children.push(new Paragraph({ text: richTextToPlainText(section.title), heading: HeadingLevel.HEADING_2 }));
        richTextToPlainText(section.content).split("\n").forEach((line) => children.push(new Paragraph({ text: line })));
      });
    });

    const wordDocument = new Document({ sections: [{ children }] });
    const blob = await Packer.toBlob(wordDocument);
    const link = window.document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${richTextToPlainText(profile.name) || "个人简历"}.docx`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const resetDraft = () => {
    if (!window.confirm("确定恢复示例内容吗？当前编辑将被清空。")) return;
    setPages(initialPages);
    setActivePage(0);
    setProfile({
      name: "林知夏",
      role: "高级产品经理",
      contact: "138 0000 0000　 hello@example.com　 杭州",
      keywords: "AI 产品 0-1｜CRM 工作流｜本地生活工具｜视频 AIGC｜复杂 Agent",
    });
    setProfileStyles({
      role: { size: 10.5, color: "#246b5b", visible: true },
      contact: { size: 10.5, color: "#246b5b", visible: true },
      keywords: { size: 10.5, color: "#246b5b", visible: true },
    });
    setPhoto("");
    setPhotoShape("square");
    setPhotoSize({ width: 102, height: 128 });
    window.localStorage.removeItem("resume-studio-draft");
  };

  const exportPdf = async () => {
    const photos = () => Array.from(document.querySelectorAll<HTMLCanvasElement>(".resume-photo canvas"));
    if (photos().some((canvas) => canvas.dataset.ready !== "true")) {
      await new Promise<void>((resolve) => {
        const finish = () => {
          if (photos().every((canvas) => canvas.dataset.ready === "true")) {
            window.removeEventListener("resume-photo-ready", finish);
            resolve();
          }
        };
        window.addEventListener("resume-photo-ready", finish);
        window.setTimeout(() => {
          window.removeEventListener("resume-photo-ready", finish);
          resolve();
        }, 5000);
      });
    }
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve())));
    window.print();
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">简</span>
          <div><strong>纸上简历</strong><small>自由排版 · 本地保存</small></div>
        </div>
        <div className="top-actions">
          <label className="text-button import-pdf-button">
            <input type="file" accept="application/pdf" onChange={(event) => { void handlePdfImport(event.target.files?.[0]); event.target.value = ""; }} />
            {isImportingPdf ? "识别中…" : "导入 PDF"}
          </label>
          <button className="text-button" onClick={undo} disabled={!canUndo}>撤回</button>
          <button className="text-button" onClick={resetDraft}>恢复示例</button>
          <span className="saved-status"><i /> 已自动保存</span>
          <button className="word-button" onClick={() => { void exportWord(); }}>导出 Word</button>
          <button className="export-button" onClick={exportPdf}>导出 PDF</button>
        </div>
      </header>

      {pageNotice && <div className="page-notice" role="status">{pageNotice}</div>}

      <div className="workspace">
        <aside className="control-panel" aria-label="简历设置">
          <section className="panel-section">
            <div className="panel-heading"><span>页面</span><b>{pages.length} 页 A4</b></div>
            <div className="page-list">
              {pages.map((page, index) => (
                <button key={page.id} className={index === activePage ? "page-chip active" : "page-chip"} onClick={() => setActivePage(index)}>
                  <span>{index + 1}</span> 第 {index + 1} 页
                </button>
              ))}
            </div>
            <button className="wide-button primary-soft" onClick={addPage}>＋ 新增 A4 页面</button>
            <div className="split-buttons">
              <button onClick={duplicatePage}>复制本页</button>
              <button onClick={deletePage} disabled={pages.length === 1}>删除本页</button>
            </div>
            <div className="split-buttons">
              <button onClick={() => movePage(-1)} disabled={activePage === 0}>↑ 本页上移</button>
              <button onClick={() => movePage(1)} disabled={activePage === pages.length - 1}>↓ 本页下移</button>
            </div>
          </section>

          <section className="panel-section">
            <div className="panel-heading"><span>文字与版式</span></div>
            <label className="field-label">字体
              <select value={fontFamily} onChange={(e) => setFontFamily(e.target.value)}>
                <option value="sans">现代黑体</option>
                <option value="serif">经典宋体</option>
                <option value="rounded">柔和圆体</option>
              </select>
            </label>
            <label className="range-label"><span>正文字号 <b>{fontSize}px</b></span><input type="range" min="10" max="16" step="0.5" value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} /></label>
            <label className="range-label"><span>行距 <b>{lineHeight.toFixed(1)}</b></span><input type="range" min="1.2" max="2" step="0.1" value={lineHeight} onChange={(e) => setLineHeight(Number(e.target.value))} /></label>
            <label className="range-label"><span>模块间距 <b>{sectionGap}px</b></span><input type="range" min="10" max="32" step="2" value={sectionGap} onChange={(e) => setSectionGap(Number(e.target.value))} /></label>
            <div className="field-label">主题色</div>
            <div className="color-row">
              {["#246b5b", "#234d79", "#8b3f3f", "#1f2937", "#765638"].map((color) => <button key={color} aria-label={`选择主题色 ${color}`} className={accent === color ? "color-dot selected" : "color-dot"} style={{ background: color }} onClick={() => setAccent(color)} />)}
              <input aria-label="自定义主题色" type="color" value={accent} onChange={(e) => setAccent(e.target.value)} />
            </div>
          </section>

          <section className="panel-section">
            <div className="panel-heading"><span>照片</span></div>
            <label className="photo-upload"><input type="file" accept="image/*" onChange={(e) => handlePhoto(e.target.files?.[0])} /><span>{photo ? "更换照片" : "上传证件照"}</span><small>JPG / PNG，建议竖版</small></label>
            <div className="split-buttons">
              <button className={photoShape === "square" ? "selected-control" : ""} onClick={() => setPhotoShape("square")}>方形</button>
              <button className={photoShape === "round" ? "selected-control" : ""} onClick={() => setPhotoShape("round")}>圆形</button>
            </div>
            <label className="range-label"><span>照片宽度 <b>{photoSize.width}px</b></span><input type="range" min="72" max="220" step="2" value={photoSize.width} onChange={(e) => setPhotoSize((size) => ({ ...size, width: Number(e.target.value) }))} /></label>
            <label className="range-label"><span>照片高度 <b>{photoSize.height}px</b></span><input type="range" min="72" max="260" step="2" value={photoSize.height} onChange={(e) => setPhotoSize((size) => ({ ...size, height: Number(e.target.value) }))} /></label>
            <small className="control-help">也可以直接拖动照片右下角自由缩放</small>
          </section>

          <section className="panel-section">
            <div className="panel-heading"><span>个人信息栏</span><b>逐栏设置</b></div>
            <div className="field-card-list">
              {([
                ["role", "求职岗位"],
                ["contact", "联系方式"],
                ["keywords", "关键词"],
              ] as const).map(([key, label]) => {
                const setting = profileStyles[key];
                return (
                  <div className="field-card" key={key}>
                    <div className="field-card-head">
                      <strong>{label}</strong>
                      <button className={setting.visible ? "visibility-button" : "visibility-button hidden"} onClick={() => setProfileStyles({ ...profileStyles, [key]: { ...setting, visible: !setting.visible } })}>{setting.visible ? "删除/隐藏" : "＋ 添加"}</button>
                    </div>
                    <div className="mini-controls">
                      <label>字号<input type="number" min="8" max="24" step="0.5" value={setting.size} onChange={(e) => setProfileStyles({ ...profileStyles, [key]: { ...setting, size: Number(e.target.value) } })} /></label>
                      <label>颜色<input type="color" value={setting.color} onChange={(e) => setProfileStyles({ ...profileStyles, [key]: { ...setting, color: e.target.value } })} /></label>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="panel-section">
            <div className="panel-heading"><span>当前页模块</span><b>可自由增删</b></div>
            <div className="section-list">
              {pages[activePage]?.sections.map((section, index) => (
                <div className="module-card" key={section.id}>
                  <div className="section-row">
                    <span>{section.title || "未命名模块"}</span>
                    <div><button aria-label="上移" onClick={() => moveSection(index, -1)}>↑</button><button aria-label="下移" onClick={() => moveSection(index, 1)}>↓</button><button aria-label="删除" onClick={() => removeSection(section.id)}>×</button></div>
                  </div>
                  <div className="module-style-grid">
                    <label>标题字号<input type="number" min="10" max="28" step="0.5" value={section.titleSize ?? 15} onChange={(e) => updateSection(activePage, section.id, { titleSize: Number(e.target.value) })} /></label>
                    <label>标题颜色<input type="color" value={section.titleColor ?? "#17201d"} onChange={(e) => updateSection(activePage, section.id, { titleColor: e.target.value })} /></label>
                    <label>正文字号<input type="number" min="8" max="24" step="0.5" value={section.contentSize ?? fontSize} onChange={(e) => updateSection(activePage, section.id, { contentSize: Number(e.target.value) })} /></label>
                    <label>正文颜色<input type="color" value={section.contentColor ?? "#343d3a"} onChange={(e) => updateSection(activePage, section.id, { contentColor: e.target.value })} /></label>
                  </div>
                </div>
              ))}
            </div>
            <button className="wide-button" onClick={addSection}>＋ 添加模块</button>
          </section>
        </aside>

        <section className="canvas-area">
          {showTips && <div className="tip-banner"><span>直接编辑文字；选中文字后点击 <b>B</b> 或按 Ctrl/⌘ + B 加粗。</span><div><button className="bold-button" aria-label="加粗选中文字" title="加粗选中文字" onMouseDown={(event) => { event.preventDefault(); document.execCommand("bold"); }}>B</button><button onClick={() => setShowTips(false)}>知道了</button></div></div>}
          <div className="pages-stack" style={{ "--resume-font-size": `${fontSize}px`, "--resume-line-height": lineHeight, "--section-gap": `${sectionGap}px`, "--accent": accent } as React.CSSProperties}>
            {pages.map((page, pageIndex) => (
              <article key={page.id} data-page-id={page.id} className={`resume-page font-${fontFamily} ${pageIndex === activePage ? "active-page" : ""}`} onClick={() => setActivePage(pageIndex)}>
                <div className="page-number">{pageIndex + 1} / {pages.length}</div>
                {pageIndex === 0 && (
                  <header className="resume-header">
                    <div className="identity">
                      <Editable className="resume-name" value={profile.name} onChange={(name) => setProfile({ ...profile, name })} />
                      {profileStyles.role.visible && <Editable className="resume-role" style={{ fontSize: profileStyles.role.size, color: profileStyles.role.color }} value={profile.role} onChange={(role) => setProfile({ ...profile, role })} />}
                      {profileStyles.contact.visible && <Editable className="resume-contact" style={{ fontSize: profileStyles.contact.size, color: profileStyles.contact.color }} value={profile.contact} onChange={(contact) => setProfile({ ...profile, contact })} />}
                      {profileStyles.keywords.visible && <div className="resume-keywords" style={{ fontSize: profileStyles.keywords.size, color: profileStyles.keywords.color }}>
                        <span>关键词：</span>
                        <Editable
                          className="resume-keywords-value"
                          value={profile.keywords ?? "AI 产品 0-1｜CRM 工作流｜本地生活工具｜视频 AIGC｜复杂 Agent"}
                          onChange={(keywords) => setProfile({ ...profile, keywords })}
                        />
                      </div>}
                    </div>
                    <PhotoEditor
                      photo={photo}
                      shape={photoShape}
                      width={photoSize.width}
                      height={photoSize.height}
                      onPhoto={handlePhoto}
                      onResize={(width, height) => setPhotoSize({ width, height })}
                    />
                  </header>
                )}
                {pageIndex > 0 && <div className="continuation"><span dangerouslySetInnerHTML={{ __html: profile.name }} /><small><span dangerouslySetInnerHTML={{ __html: profile.role }} /> · 续页 {pageIndex + 1}</small></div>}
                <div className="resume-sections">
                  {page.sections.map((section) => (
                    <section className="resume-section" key={section.id}>
                      <Editable className="section-title" style={{ fontSize: section.titleSize ?? 15, color: section.titleColor ?? "#17201d" }} value={section.title} onChange={(title) => updateSection(pageIndex, section.id, { title })} />
                      <Editable className="section-content" style={{ fontSize: section.contentSize ?? fontSize, color: section.contentColor ?? "#343d3a" }} multiline value={section.content} onChange={(content) => updateSection(pageIndex, section.id, { content })} />
                    </section>
                  ))}
                </div>
                <footer className="resume-footer"><span dangerouslySetInnerHTML={{ __html: profile.name }} /> · 个人简历</footer>
              </article>
            ))}
            <button className="add-page-card" onClick={addPage}><span>＋</span><strong>添加下一页</strong><small>新建一张标准 A4 页面</small></button>
          </div>
        </section>
      </div>
    </main>
  );
}
