import { categories as fallbackCategories } from "../data/marketData.js";
import SocialHub from "./SocialHub.jsx";

export default function CategoryDropdown({ open, onSelect, categories = fallbackCategories }) {
  return (
    <div
      id="category-menu"
      role="region"
      aria-label="Service categories"
      aria-hidden={!open}
      onClick={(event) => event.stopPropagation()}
      className={`overscroll-contain ${
        open ? "mt-3 block max-h-96 overflow-y-auto" : "hidden"
      }`}
    >
      <SocialHub categories={categories} onSelect={onSelect} />
    </div>
  );
}
