interface ThinkingBlockProps {
  thinking: string;
  open: boolean;
  onToggle: () => void;
}

export function ThinkingBlock({ thinking, open, onToggle }: ThinkingBlockProps) {
  return (
    <div className="ml-14 mb-2 max-w-[85%]">
      <button
        onClick={onToggle}
        className="flex items-center gap-2 bg-purple-900/5 border border-purple-900/10 rounded-lg px-3 py-1.5 text-[11px] text-purple-800 font-bold hover:bg-purple-900/10 transition-colors"
      >
        🧠 Raciocínio interno — {open ? '▲ ocultar' : '▼ expandir'}
      </button>
      {open && (
        <div className="mt-1 bg-[#F3E5F5] border border-[#CE93D8] rounded-b-xl rounded-tr-xl p-4 text-[12px] text-[#4A148C] whitespace-pre-wrap max-h-96 overflow-y-auto font-mono">
          {thinking}
        </div>
      )}
    </div>
  );
}
