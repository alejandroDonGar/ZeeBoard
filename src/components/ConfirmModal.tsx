function ConfirmModal({
  eyebrow,
  eyebrowTone = "neutral",
  title,
  message,
  cancelLabel = "Cancel",
  confirmLabel,
  confirmingLabel,
  isConfirming = false,
  confirmVariant = "danger",
  onConfirm,
  onCancel,
}: {
  eyebrow: string;
  eyebrowTone?: "neutral" | "danger";
  title: string;
  message: string;
  cancelLabel?: string;
  confirmLabel: string;
  confirmingLabel?: string;
  isConfirming?: boolean;
  confirmVariant?: "danger" | "primary";
  onConfirm: () => void;
  onCancel?: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="w-[450px] rounded-[2rem] border border-[#e1d8ca] bg-white p-6 shadow-2xl">
        <p
          className={
            eyebrowTone === "danger"
              ? "text-xs font-bold uppercase tracking-[0.2em] text-red-500"
              : "text-xs font-bold uppercase tracking-[0.2em] text-[#9a8f82]"
          }
        >
          {eyebrow}
        </p>

        <h3 className="mt-2 text-2xl font-black text-[#1f2933]">
          {title}
        </h3>

        <p className="mt-4 whitespace-pre-line text-sm text-[#7c7163]">
          {message}
        </p>

        <div className="mt-6 flex justify-end gap-3">
          {onCancel && (
            <button
              onClick={onCancel}
              className="rounded-2xl border border-[#d8cec0] px-4 py-2 font-semibold"
            >
              {cancelLabel}
            </button>
          )}

          <button
            onClick={onConfirm}
            disabled={isConfirming}
            className={
              confirmVariant === "danger"
                ? "rounded-2xl bg-red-500 px-4 py-2 font-bold text-white disabled:cursor-not-allowed disabled:opacity-70"
                : "rounded-2xl bg-[#1f2933] px-4 py-2 font-bold text-white disabled:cursor-not-allowed disabled:opacity-70"
            }
          >
            {isConfirming && confirmingLabel ? confirmingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;