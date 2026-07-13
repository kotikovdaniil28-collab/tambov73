"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { BookOpen, ChevronDown, ListOrdered } from "lucide-react";
import { getSupabase } from "@/lib/supabase/client";
import { INSTRUCTION_ROW, loadInstruction } from "@/lib/instructions";
import { AiAssistant } from "@/components/help/ai-assistant";
import { Card, CardContent } from "@/components/ui/card";

// Безопасный рендер простого Markdown в React-элементы (без innerHTML)
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const regex = /\*\*(.+?)\*\*|`(.+?)`/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > lastIndex) parts.push(text.slice(lastIndex, m.index));
    if (m[1] !== undefined) {
      parts.push(<strong key={`${keyPrefix}-b${k++}`}>{m[1]}</strong>);
    } else if (m[2] !== undefined) {
      parts.push(
        <code key={`${keyPrefix}-c${k++}`} className="bg-muted rounded px-1 py-0.5 font-mono text-xs">
          {m[2]}
        </code>
      );
    }
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

// Извлекает разделы (## ...) для панели навигации
export function extractSections(text: string): { id: string; title: string }[] {
  const sections: { id: string; title: string }[] = [];
  let idx = 0;
  for (const raw of text.split("\n")) {
    const trimmed = raw.trim();
    if (trimmed.startsWith("## ") && !trimmed.startsWith("###")) {
      sections.push({ id: `section-${idx}`, title: trimmed.slice(3).trim() });
      idx += 1;
    }
  }
  return sections;
}

function MarkdownLite({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let listItems: string[] = [];
  let tableRows: string[][] = [];
  let key = 0;
  let sectionIdx = 0;

  const flushTable = () => {
    if (tableRows.length === 0) return;
    const [head, ...body] = tableRows;
    blocks.push(
      <div key={`tbl-${key++}`} className="overflow-x-auto">
        <table className="border-border my-2 w-full border-collapse rounded-lg border text-sm">
          <thead>
            <tr className="bg-secondary">
              {head.map((cell, i) => (
                <th key={i} className="border-border border px-3 py-2 text-left font-semibold">
                  {renderInline(cell, `th-${key}-${i}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((row, r) => (
              <tr key={r} className="even:bg-secondary/40">
                {row.map((cell, c) => (
                  <td key={c} className="border-border border px-3 py-2 align-top">
                    {renderInline(cell, `td-${key}-${r}-${c}`)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    tableRows = [];
  };

  const flushList = () => {
    if (listItems.length > 0) {
      blocks.push(
        <ul key={`ul-${key++}`} className="list-disc space-y-1 pl-6 text-sm leading-relaxed">
          {listItems.map((item, i) => (
            <li key={i}>{renderInline(item, `li-${key}-${i}`)}</li>
          ))}
        </ul>
      );
      listItems = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trim();
    // Строка таблицы: | ячейка | ячейка |
    if (trimmed.startsWith("|") && trimmed.endsWith("|") && trimmed.length > 2) {
      const cells = trimmed.slice(1, -1).split("|").map((c) => c.trim());
      // Разделитель шапки (| --- | --- |) пропускаем
      if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) tableRows.push(cells);
      continue;
    }
    flushTable();
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      listItems.push(trimmed.slice(2));
      continue;
    }
    flushList();
    if (trimmed.startsWith("### ")) {
      blocks.push(
        <h4 key={`h-${key++}`} className="pt-2 text-sm font-semibold">
          {renderInline(trimmed.slice(4), `h4-${key}`)}
        </h4>
      );
    } else if (trimmed.startsWith("## ")) {
      blocks.push(
        <h3
          key={`h-${key++}`}
          id={`section-${sectionIdx++}`}
          className="scroll-mt-24 pt-3 text-base font-semibold"
        >
          {renderInline(trimmed.slice(3), `h3-${key}`)}
        </h3>
      );
    } else if (trimmed.startsWith("# ")) {
      blocks.push(
        <h2 key={`h-${key++}`} className="pt-3 text-lg font-bold">
          {renderInline(trimmed.slice(2), `h2-${key}`)}
        </h2>
      );
    } else if (trimmed === "") {
      blocks.push(<div key={`sp-${key++}`} className="h-1" />);
    } else {
      blocks.push(
        <p key={`p-${key++}`} className="text-sm leading-relaxed">
          {renderInline(trimmed, `p-${key}`)}
        </p>
      );
    }
  }
  flushTable();
  flushList();
  return <div className="flex flex-col gap-1.5">{blocks}</div>;
}

// Панель оглавления: скролл к разделу + подсветка текущего при прокрутке
function TableOfContents({ sections }: { sections: { id: string; title: string }[] }) {
  const [activeId, setActiveId] = useState<string>("");
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (sections.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );
    for (const s of sections) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [sections]);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setMobileOpen(false);
  };

  if (sections.length === 0) return null;

  const items = sections.map((s) => {
    const active = s.id === activeId;
    return (
      <button
        key={s.id}
        type="button"
        onClick={() => scrollTo(s.id)}
        className={`w-full rounded-lg px-3 py-1.5 text-left text-sm transition-colors ${
          active
            ? "bg-primary/10 text-primary font-semibold"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
        }`}
      >
        {s.title}
      </button>
    );
  });

  return (
    <>
      {/* Мобильная версия: раскрывающийся список над контентом */}
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          aria-expanded={mobileOpen}
          className="border-border bg-card flex w-full items-center justify-between rounded-xl border px-4 py-3 text-sm font-semibold"
        >
          <span className="flex items-center gap-2">
            <ListOrdered className="text-primary size-4" />
            Содержание
          </span>
          <ChevronDown className={`size-4 transition-transform ${mobileOpen ? "rotate-180" : ""}`} />
        </button>
        {mobileOpen && (
          <nav aria-label="Содержание инструкции" className="border-border bg-card mt-2 flex flex-col gap-0.5 rounded-xl border p-2">
            {items}
          </nav>
        )}
      </div>

      {/* Десктоп: липкая панель сбоку */}
      <nav
        aria-label="Содержание инструкции"
        className="border-border bg-card sticky top-24 hidden max-h-[calc(100vh-8rem)] w-60 shrink-0 flex-col gap-0.5 self-start overflow-y-auto rounded-xl border p-2 lg:flex"
      >
        <p className="text-muted-foreground flex items-center gap-2 px-3 py-2 text-xs font-semibold tracking-wide uppercase">
          <ListOrdered className="text-primary size-3.5" />
          Содержание
        </p>
        {items}
      </nav>
    </>
  );
}

export function HelpClient() {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    loadInstruction(getSupabase(), INSTRUCTION_ROW).then(setText);
  }, []);

  const sections = useMemo(() => (text ? extractSections(text) : []), [text]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
          <BookOpen className="size-5" />
        </span>
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight md:text-2xl">Инструкция</h1>
          <p className="text-muted-foreground text-sm">
            Правила и инструкции команды модерации Tambov 89
          </p>
        </div>
      </div>

      <AiAssistant instruction={text || ""} />

      <div className="flex flex-col items-stretch gap-4 lg:flex-row lg:items-start lg:gap-6">
        <TableOfContents sections={sections} />
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="min-w-0 flex-1"
        >
          <Card>
            <CardContent className="p-6">
              {text === null ? (
                <p className="text-muted-foreground text-sm">Загрузка…</p>
              ) : text.trim() === "" ? (
                <p className="text-muted-foreground text-sm">
                  Инструкция ещё не заполнена. Руководство может добавить её в разделе
                  «Администрирование».
                </p>
              ) : (
                <MarkdownLite text={text} />
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
