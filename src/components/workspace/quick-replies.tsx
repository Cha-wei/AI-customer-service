// UI copy only: selecting a reply fills the draft; it never performs a business action.
const replies = ["您好，我来为您处理。", "请稍等，我正在核实。", "还有其他可以帮您的吗？"];

export function QuickReplies({ onSelect, disabled }: { onSelect: (text: string) => void; disabled: boolean }) {
  return <div className="quick-replies" aria-label="快捷回复">{replies.map(text => <button type="button" className="quick-reply" disabled={disabled} key={text} onClick={() => onSelect(text)}>{text}</button>)}</div>;
}
