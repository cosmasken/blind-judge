import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

/**
 * 右上に固定表示される言語切り替えボタン。
 * 現在の言語が "ja" なら "EN" を、"en" なら "JA" を表示し、クリックで切り替える。
 * 選択した言語は localStorage に保存し、次回起動時に復元される。
 */
export function LanguageToggle() {
  const { i18n } = useTranslation();
  const current = i18n.language;
  const next = current === "ja" ? "en" : "ja";
  const label = current === "ja" ? "EN" : "JA";

  const toggle = () => {
    i18n.changeLanguage(next);
    localStorage.setItem("lang", next);
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className="fixed top-4 right-4 z-50 font-mono text-xs"
      onClick={toggle}
      aria-label={`Switch to ${next.toUpperCase()}`}
    >
      {label}
    </Button>
  );
}
