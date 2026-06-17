export function numberToArabicWords(num: number): string {
  if (num === 0) return "صفر";

  const ones = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة", "عشرة"];
  const teens = ["", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر", "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر"];
  const tens = ["", "عشرة", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
  const hundreds = ["", "مائة", "مائتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"];

  let words = "";

  if (num >= 1000) {
    const thousands = Math.floor(num / 1000);
    if (thousands === 1) {
      words += "ألف";
    } else if (thousands === 2) {
      words += "ألفان";
    } else if (thousands >= 3 && thousands <= 10) {
      words += ones[thousands] + " آلاف";
    } else {
      words += numberToArabicWords(thousands) + " ألف";
    }
    num %= 1000;
    if (num > 0) words += " و";
  }

  if (num >= 100) {
    const hundredVal = Math.floor(num / 100);
    words += hundreds[hundredVal];
    num %= 100;
    if (num > 0) words += " و";
  }

  if (num > 0) {
    if (num <= 10) {
      words += ones[num];
    } else if (num < 20) {
      words += teens[num - 10];
    } else {
      const oneVal = num % 10;
      const tenVal = Math.floor(num / 10);
      if (oneVal > 0) {
        words += ones[oneVal] + " و";
      }
      words += tens[tenVal];
    }
  }

  return words.trim();
}
