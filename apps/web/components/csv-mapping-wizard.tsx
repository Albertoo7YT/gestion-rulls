"use client";

import { useEffect, useMemo, useState } from "react";

type FieldOption = {
  key: string;
  label: string;
  required?: boolean;
};

type CsvMappingWizardProps = {
  title: string;
  fields: FieldOption[];
  onImport: (rows: Record<string, string>[]) => Promise<void> | void;
  onStatus?: (message: string | null) => void;
};

type CsvState = {
  rows: string[][];
  headers: string[];
  preview: string[];
};

function parseCsv(text: string, delimiter: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.split(delimiter).map((cell) => cell.trim()));
}

export default function CsvMappingWizard({
  title,
  fields,
  onImport,
  onStatus,
}: CsvMappingWizardProps) {
  const [fileName, setFileName] = useState("");
  const [csv, setCsv] = useState<CsvState | null>(null);
  const [rawText, setRawText] = useState("");
  const [hasHeader, setHasHeader] = useState(true);
  const [mapping, setMapping] = useState<Record<number, string>>({});
  const [delimiter, setDelimiter] = useState(",");

  const usedKeys = useMemo(() => {
    return new Set(Object.values(mapping).filter(Boolean));
  }, [mapping]);

  const missingRequired = useMemo(() => {
    const required = fields.filter((f) => f.required).map((f) => f.key);
    return required.filter((key) => !usedKeys.has(key));
  }, [fields, usedKeys]);

  const dataRows = useMemo(() => {
    if (!csv) return [];
    return csv.rows.slice(hasHeader ? 1 : 0);
  }, [csv, hasHeader]);

  async function handleFile(file: File) {
    onStatus?.(null);
    try {
      const text = await file.text();
      setRawText(text);
      const rows = parseCsv(text, delimiter);
      if (!rows.length) {
        onStatus?.("CSV vacio.");
        setCsv(null);
        return;
      }
      const headers = rows[0].map((cell, index) =>
        cell || `Columna ${index + 1}`,
      );
      const previewRow = rows.length > 1 ? rows[1] : rows[0];
      setCsv({ rows, headers, preview: previewRow });
      setFileName(file.name);
      setMapping({});
    } catch {
      onStatus?.("No se pudo leer el CSV.");
    }
  }

  useEffect(() => {
    if (!rawText) return;
    const rows = parseCsv(rawText, delimiter);
    if (!rows.length) {
      setCsv(null);
      return;
    }
    const headers = rows[0].map((cell, index) =>
      cell || `Columna ${index + 1}`,
    );
    const previewRow = rows.length > 1 ? rows[1] : rows[0];
    setCsv({ rows, headers, preview: previewRow });
    setMapping({});
  }, [delimiter, rawText]);

  async function applyImport() {
    if (!csv) return;
    if (missingRequired.length > 0) {
      onStatus?.("Faltan campos obligatorios en el mapeo.");
      return;
    }
    const mapped = dataRows
      .map((row) => {
        const record: Record<string, string> = {};
        Object.entries(mapping).forEach(([indexStr, key]) => {
          if (!key) return;
          const index = Number(indexStr);
          record[key] = row[index] ?? "";
        });
        return record;
      })
      .filter((record) => Object.keys(record).length > 0);

    if (mapped.length === 0) {
      onStatus?.("No se encontraron lineas validas.");
      return;
    }
    await onImport(mapped);
    onStatus?.(`Importadas ${mapped.length} lineas.`);
  }

  return (
    <div className="csv-wizard stack">
      <strong>{title}</strong>
      <label className="stack">
        <span className="muted">Archivo CSV</span>
        <input
          className="input"
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            handleFile(file);
            event.currentTarget.value = "";
          }}
        />
      </label>

      {csv && (
        <>
          <div className="row csv-controls">
            <span className="muted">Archivo: {fileName}</span>
            <label className="stack">
              <span className="muted">Separador</span>
              <select
                className="input"
                value={delimiter}
                onChange={(event) => setDelimiter(event.target.value)}
              >
                <option value=",">Coma (,)</option>
                <option value=";">Punto y coma (;)</option>
                <option value="|">Barra vertical (|)</option>
                <option value="\t">Tabulador</option>
              </select>
            </label>
            <label className="row">
              <input
                type="checkbox"
                checked={hasHeader}
                onChange={(event) => setHasHeader(event.target.checked)}
              />
              <span className="muted">Primera fila es encabezado</span>
            </label>
          </div>
          <div className="csv-preview">
            <div className="csv-preview-row">
              {csv.headers.map((header, index) => {
                const previewValue = csv.preview[index] ?? "";
                const selected = mapping[index] ?? "";
                return (
                  <div className="csv-preview-col" key={`${header}-${index}`}>
                    <div className="csv-preview-label">{header}</div>
                    <div className="csv-preview-value">{previewValue || "-"}</div>
                    <select
                      className="input"
                      value={selected}
                      onChange={(event) =>
                        setMapping((prev) => ({
                          ...prev,
                          [index]: event.target.value,
                        }))
                      }
                    >
                      <option value="">Ignorar</option>
                      {fields.map((field) => {
                        const inUse = usedKeys.has(field.key);
                        const isCurrent = selected === field.key;
                        return (
                          <option
                            key={field.key}
                            value={field.key}
                            disabled={inUse && !isCurrent}
                          >
                            {field.label}
                            {field.required ? " *" : ""}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>
          {missingRequired.length > 0 && (
            <p className="inline-error">
              Faltan campos obligatorios: {missingRequired.join(", ")}
            </p>
          )}
          <div className="row">
            <button onClick={applyImport}>Importar</button>
          </div>
        </>
      )}
    </div>
  );
}
