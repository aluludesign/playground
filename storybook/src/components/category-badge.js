import "./category-badge.css";
import { faTrainSubway } from "@fortawesome/free-solid-svg-icons/faTrainSubway";
import { faBed } from "@fortawesome/free-solid-svg-icons/faBed";
import { faUtensils } from "@fortawesome/free-solid-svg-icons/faUtensils";
import { faCamera } from "@fortawesome/free-solid-svg-icons/faCamera";
import { faBagShopping } from "@fortawesome/free-solid-svg-icons/faBagShopping";
import { faEllipsis } from "@fortawesome/free-solid-svg-icons/faEllipsis";
import { faSVG } from "../fa.js";
import { progressColor } from "./progress-bar.js";

/* 花費的六個分類：icon 和顏色（顏色跟分類佔比長條同一組 custom） */
export const CATEGORIES = {
  transport: { name: "交通", icon: faTrainSubway, color: "custom 8" },
  stay: { name: "住宿", icon: faBed, color: "custom 11" },
  food: { name: "餐飲", icon: faUtensils, color: "custom 1" },
  sight: { name: "景點", icon: faCamera, color: "custom 4" },
  shop: { name: "購物", icon: faBagShopping, color: "custom 14" },
  other: { name: "其他", icon: faEllipsis, color: "disable" },
};

/** 一顆分類圓章。key：transport／stay／food／sight／shop／other */
export function categoryBadgeHTML({ key = "other", label } = {}) {
  const c = CATEGORIES[key] || CATEGORIES.other;
  const name = label || c.name;
  return `<span class="ds-cat-badge" style="--cat-color:${progressColor(c.color)}" role="img" aria-label="${name}" title="${name}">${faSVG(c.icon, "ds-cat-badge__icon")}</span>`;
}
