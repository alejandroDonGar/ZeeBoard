import { useEffect, useState } from "react";
import {
  createTag,
  deleteTag,
  getTags,
  type Tag,
} from "../lib/database";
import PageHeader from "../components/PageHeader";
import ConfirmModal from "../components/ConfirmModal";
import { useToast } from "../context/ToastContext";

function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [tagName, setTagName] = useState("");
  const [tagColor, setTagColor] = useState("#f59e0b");
  const [tagCategory, setTagCategory] = useState("General");
  const [creatingTag, setCreatingTag] = useState(false);
  const [tagCreated, setTagCreated] = useState(false);
  const [tagToDelete, setTagToDelete] = useState<Tag | null>(null);
  const { showToast } = useToast();

  async function loadTags() {
    const data = await getTags();
    setTags(data);
  }

  async function handleCreateTag() {
    try {
      setCreatingTag(true);

      await createTag(tagName, tagColor, tagCategory);

      setTagName("");
      setTagColor("#f59e0b");

      await loadTags();

      setTagCreated(true);

      setTimeout(() => {
        setTagCreated(false);
      }, 1500);
    } catch (error) {
      console.error(error);
    } finally {
      setCreatingTag(false);
    }
  }

    async function handleDeleteTag(tagId: number) {
    try {
        await deleteTag(tagId);
        await loadTags();
        showToast("Tag deleted.", "success");
    } catch (error) {
        console.error(error);
        showToast("Could not delete tag. It may still be in use.", "error");
    }
    }

  useEffect(() => {
    loadTags().catch(console.error);
  }, []);

  const groupedTags = tags.reduce(
    (groups, tag) => {
      const category =
        tag.category || "General";

      if (!groups[category]) {
        groups[category] = [];
      }

      groups[category].push(tag);

      return groups;
    },
    {} as Record<string, Tag[]>,
  );

  return (
    <>
      <PageHeader
        label="Label library"
        title="Tags"
        description="Create reusable tags to classify commissions."
      />

      <section className="grid h-[calc(100vh-117px)] min-h-0 grid-cols-[340px_minmax(0,1fr)] gap-5 overflow-hidden p-5 pb-6">
        <div className="flex min-h-0 flex-col rounded-[2rem] border border-[#e1d8ca] bg-white p-5 shadow-sm">
          <div className="mb-5">
            <h3 className="text-xl font-black">New tag</h3>
            <p className="mt-1 text-sm text-[#7c7163]">
              Use tags like urgent, commercial or personal.
            </p>
          </div>

          <input
            value={tagName}
            onChange={(event) => setTagName(event.target.value)}
            placeholder="Tag name"
            className="rounded-2xl border border-[#d8cec0] bg-[#fffaf2] px-4 py-3 text-sm font-semibold outline-none transition focus:border-[#1f2933]"
          />

          

          <div className="mt-3 flex items-center gap-3 rounded-2xl border border-[#d8cec0] bg-[#fffaf2] px-4 py-3">
            <label
              className="flex h-14 w-14 cursor-pointer items-center justify-center rounded-2xl border border-[#d8cec0] bg-white shadow-sm"
              style={{ backgroundColor: tagColor }}
            >
              <input
                type="color"
                value={tagColor}
                onChange={(event) => setTagColor(event.target.value)}
                className="h-full w-full cursor-pointer opacity-0"
              />
            </label>

            <div>
              <p className="text-sm font-bold">
                Selected colour
              </p>

              <p className="text-xs text-[#9a8f82]">
                Click to change
              </p>
            </div>
            <select
              value={tagCategory}
              onChange={(event) =>
                setTagCategory(event.target.value)
              }
              className="mt-3 rounded-2xl border border-[#d8cec0] bg-[#fffaf2] px-4 py-3"
            >
              <option>Payment</option>
              <option>Characters</option>
              <option>Commission Type</option>
              <option>Reference</option>
              <option>General</option>
            </select>
          </div>

          <div className="mt-4 rounded-3xl border border-[#e6ded2] bg-[#fffaf2] p-4">
            <div className="mt-3">
              <span
                className="inline-flex rounded-full px-4 py-2 text-sm font-black text-white shadow-sm"
                style={{ backgroundColor: tagColor }}
              >
                {tagName || "Example tag"}
              </span>
            </div>
            
          </div>

          <button
            onClick={handleCreateTag}
            disabled={creatingTag}
            className={
              tagCreated
                ? "mt-3 rounded-2xl bg-green-600 px-4 py-3 text-sm font-bold text-white shadow-md transition-all duration-300"
                : "mt-3 rounded-2xl bg-[#1f2933] px-4 py-3 text-sm font-bold text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg"
            }
          >
            {creatingTag
              ? "Creating..."
              : tagCreated
                ? "✓ Created"
                : "Create tag"}
          </button>
        </div>

        <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[2rem] border border-[#e1d8ca] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-xl font-black">Saved tags</h3>

            <span className="rounded-full bg-[#fffaf2] px-3 py-1 text-xs font-bold text-[#9a8f82]">
              {tags.length} tags
            </span>
          </div>

          <div className="mt-5 min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-2">
            {tags.length === 0 ? (
              <div className="flex h-[300px] items-center justify-center rounded-3xl border border-dashed border-[#d8cec0] bg-[#fffaf2] text-sm text-[#9a8f82]">
                No tags yet
              </div>
            ) : (
              <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-2">
                {Object.entries(groupedTags).map(
                  ([category, categoryTags]) => (
                    <div key={category} className="pb-7">
                      <h4 className="mb-3 text-sm font-black uppercase tracking-[0.16em] text-[#9a8f82]">
                        {category}
                      </h4>

                      <div className="flex flex-wrap gap-x-4 gap-y-3">
                        {categoryTags.map((tag) => (
                          <div
                            key={tag.id}
                            className="flex items-center gap-2 rounded-full border border-[#e6ded2] bg-[#fffaf2] p-1 shadow-sm"
                          >
                            <span
                              className="rounded-full px-4 py-2 text-sm font-black text-white"
                              style={{ backgroundColor: tag.color }}
                            >
                              {tag.name}
                            </span>

                            <button
                              onClick={() => setTagToDelete(tag)}
                              className="rounded-full px-2 text-xs font-black text-red-500 transition hover:bg-red-50"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ),
                )}
              </div>
            )}
          </div>
        </div>
      </section>
      {tagToDelete && (
        <ConfirmModal
            eyebrow="Delete tag"
            title={tagToDelete.name}
            message="This action cannot be undone."
            confirmLabel="Delete"
            onConfirm={async () => {
            await handleDeleteTag(tagToDelete.id);
            setTagToDelete(null);
            }}
            onCancel={() => setTagToDelete(null)}
        />
        )}
    </>
  );
}

export default TagsPage;