const path = require("path");
const fs = require("fs");
const ExcelJS = require("exceljs");
const db = require("../src/db/connection");

async function run() {
  const backupDir = path.resolve(__dirname, "../../../data/backups/incidents");
  fs.mkdirSync(backupDir, { recursive: true });

  const rows = db.prepare("SELECT * FROM incidents ORDER BY id DESC").all();

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Incidents");

  if (rows.length > 0) {
    sheet.columns = Object.keys(rows[0]).map((key) => ({
      header: key,
      key,
      width: 22,
    }));

    sheet.addRows(rows);
  } else {
    sheet.columns = [{ header: "info", key: "info", width: 40 }];
    sheet.addRow({ info: "No hay incidentes para exportar" });
  }

  const fileName = `incidents-${new Date().toISOString().replace(/[:.]/g, "-")}.xlsx`;
  const filePath = path.join(backupDir, fileName);

  await workbook.xlsx.writeFile(filePath);

  console.log(`Incidents exported to ${filePath}`);
}

run().catch((err) => {
  console.error("EXPORT ERROR:");
  console.error(err);
  process.exit(1);
});