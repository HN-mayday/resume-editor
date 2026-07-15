"use client";

import { useEffect, useRef, useState } from "react";

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

const makeId = () => Math.random().toString(36).slice(2, 9);

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
    if (ref.current && ref.current.innerText !== value) ref.current.innerText = value;
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
      onInput={(event) => onChange(event.currentTarget.innerText)}
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
  const [showTips, setShowTips] = useState(true);
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
            settings: { fontSize, lineHeight, sectionGap, fontFamily, accent, photoShape },
          }),
        );
      } catch {
        // Large photos may exceed local storage; editing still works for this session.
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [pages, profile, profileStyles, photo, fontSize, lineHeight, sectionGap, fontFamily, accent, photoShape]);

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
    setPages((current) => current.filter((_, index) => index !== activePage));
    setActivePage((current) => Math.max(0, current - 1));
  };

  const handlePhoto = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto(String(reader.result));
    reader.readAsDataURL(file);
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
    window.localStorage.removeItem("resume-studio-draft");
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">简</span>
          <div><strong>纸上简历</strong><small>自由排版 · 本地保存</small></div>
        </div>
        <div className="top-actions">
          <button className="text-button" onClick={resetDraft}>恢复示例</button>
          <span className="saved-status"><i /> 已自动保存</span>
          <button className="export-button" onClick={() => window.print()}>导出 PDF</button>
        </div>
      </header>

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
          {showTips && <div className="tip-banner"><span>直接点击纸张上的文字即可编辑；每张纸都是标准 A4。</span><button onClick={() => setShowTips(false)}>知道了</button></div>}
          <div className="pages-stack" style={{ "--resume-font-size": `${fontSize}px`, "--resume-line-height": lineHeight, "--section-gap": `${sectionGap}px`, "--accent": accent } as React.CSSProperties}>
            {pages.map((page, pageIndex) => (
              <article key={page.id} className={`resume-page font-${fontFamily} ${pageIndex === activePage ? "active-page" : ""}`} onClick={() => setActivePage(pageIndex)}>
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
                    <label className={`resume-photo ${photoShape}`}>
                      {photo ? <img src={photo} alt="个人照片" /> : <><span>＋</span><small>添加照片</small></>}
                      <input type="file" accept="image/*" onChange={(e) => handlePhoto(e.target.files?.[0])} />
                    </label>
                  </header>
                )}
                {pageIndex > 0 && <div className="continuation"><span>{profile.name}</span><small>{profile.role} · 续页 {pageIndex + 1}</small></div>}
                <div className="resume-sections">
                  {page.sections.map((section) => (
                    <section className="resume-section" key={section.id}>
                      <Editable className="section-title" style={{ fontSize: section.titleSize ?? 15, color: section.titleColor ?? "#17201d" }} value={section.title} onChange={(title) => updateSection(pageIndex, section.id, { title })} />
                      <Editable className="section-content" style={{ fontSize: section.contentSize ?? fontSize, color: section.contentColor ?? "#343d3a" }} multiline value={section.content} onChange={(content) => updateSection(pageIndex, section.id, { content })} />
                    </section>
                  ))}
                </div>
                <footer className="resume-footer">{profile.name} · 个人简历</footer>
              </article>
            ))}
            <button className="add-page-card" onClick={addPage}><span>＋</span><strong>添加下一页</strong><small>新建一张标准 A4 页面</small></button>
          </div>
        </section>
      </div>
    </main>
  );
}
