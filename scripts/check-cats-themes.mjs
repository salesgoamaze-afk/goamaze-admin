import { db } from "../lib/db.ts";

const cats = await db.getCategories();
console.log("Total Categories:", cats.length);
console.log(cats.slice(0, 10));

const themes = await db.getThemes();
console.log("Total Themes:", themes.length);
console.log(themes);
