export function downloadFile(filename: string, content: string, type = 'text/csv;charset=utf-8') {
  // BOM so Excel opens UTF-8 CSVs with the right characters.
  const blob = new Blob([`\uFEFF${content}`], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}