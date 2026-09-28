type SpreadsheetContext = {
  userId?: string;
};

type SpreadsheetInput = {
  operation?: unknown;
  data?: unknown;
  rows?: unknown;
  filter?: unknown;
  sort?: unknown;
  group_by?: unknown;
  aggregate?: unknown;
  output_format?: unknown;
};

type Row = Record<string, unknown>;

const MAX_ROWS = 50_000;
const MAX_COLUMNS = 200;
const MAX_OUTPUT_ROWS = 50_000;

function getString(
  value: unknown,
  field: string
): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field} is required`);
  }

  return value.trim();
}

function extractInput(
  input: unknown
): SpreadsheetInput {
  if (!input || typeof input !== "object") {
    throw new Error(
      "spreadsheet input is required"
    );
  }

  return input as SpreadsheetInput;
}

function normalizeRows(value: unknown): Row[] {
  if (!Array.isArray(value)) {
    throw new Error(
      "data or rows must be an array"
    );
  }

  if (value.length > MAX_ROWS) {
    throw new Error(
      `Spreadsheet exceeds the ${MAX_ROWS.toLocaleString()} row limit`
    );
  }

  const rows: Row[] = [];

  for (const item of value) {
    if (
      !item ||
      typeof item !== "object" ||
      Array.isArray(item)
    ) {
      throw new Error(
        "Each spreadsheet row must be an object"
      );
    }

    rows.push(item as Row);
  }

  return rows;
}

function getColumns(rows: Row[]): string[] {
  const columns = new Set<string>();

  for (const row of rows) {
    for (const key of Object.keys(row)) {
      columns.add(key);

      if (columns.size > MAX_COLUMNS) {
        throw new Error(
          `Spreadsheet exceeds the ${MAX_COLUMNS} column limit`
        );
      }
    }
  }

  return Array.from(columns);
}

function normalizeNumber(
  value: unknown
): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value)
      ? value
      : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value
    .replace(/,/g, "")
    .replace(/[$€£₹%]/g, "")
    .trim();

  if (!cleaned) {
    return null;
  }

  const number = Number(cleaned);

  return Number.isFinite(number)
    ? number
    : null;
}

function compareValues(
  a: unknown,
  b: unknown
): number {
  const aNumber = normalizeNumber(a);
  const bNumber = normalizeNumber(b);

  if (aNumber !== null && bNumber !== null) {
    return aNumber - bNumber;
  }

  const aString =
    a === null || a === undefined
      ? ""
      : String(a);

  const bString =
    b === null || b === undefined
      ? ""
      : String(b);

  return aString.localeCompare(
    bString,
    undefined,
    {
      numeric: true,
      sensitivity: "base",
    }
  );
}

function applyFilter(
  rows: Row[],
  filter: unknown
): Row[] {
  if (!filter) {
    return rows;
  }

  if (
    typeof filter !== "object" ||
    Array.isArray(filter)
  ) {
    throw new Error(
      "filter must be an object"
    );
  }

  const config =
    filter as Record<string, unknown>;

  const column = getString(
    config.column,
    "filter.column"
  );

  const operator = getString(
    config.operator,
    "filter.operator"
  );

  const expected = config.value;

  return rows.filter((row) => {
    const actual = row[column];

    switch (operator) {
      case "eq":
      case "=":
        return compareValues(
          actual,
          expected
        ) === 0;

      case "neq":
      case "!=":
        return compareValues(
          actual,
          expected
        ) !== 0;

      case "gt":
      case ">":
        return compareValues(
          actual,
          expected
        ) > 0;

      case "gte":
      case ">=":
        return compareValues(
          actual,
          expected
        ) >= 0;

      case "lt":
      case "<":
        return compareValues(
          actual,
          expected
        ) < 0;

      case "lte":
      case "<=":
        return compareValues(
          actual,
          expected
        ) <= 0;

      case "contains":
        return String(actual ?? "")
          .toLowerCase()
          .includes(
            String(expected ?? "").toLowerCase()
          );

      case "starts_with":
        return String(actual ?? "")
          .toLowerCase()
          .startsWith(
            String(expected ?? "").toLowerCase()
          );

      case "ends_with":
        return String(actual ?? "")
          .toLowerCase()
          .endsWith(
            String(expected ?? "").toLowerCase()
          );

      case "is_empty":
        return (
          actual === null ||
          actual === undefined ||
          String(actual).trim() === ""
        );

      case "is_not_empty":
        return !(
          actual === null ||
          actual === undefined ||
          String(actual).trim() === ""
        );

      default:
        throw new Error(
          `Unsupported filter operator: ${operator}`
        );
    }
  });
}

function applySort(
  rows: Row[],
  sort: unknown
): Row[] {
  if (!sort) {
    return rows;
  }

  if (
    typeof sort !== "object" ||
    Array.isArray(sort)
  ) {
    throw new Error(
      "sort must be an object"
    );
  }

  const config =
    sort as Record<string, unknown>;

  const column = getString(
    config.column,
    "sort.column"
  );

  const direction =
    typeof config.direction === "string" &&
    config.direction.toLowerCase() === "desc"
      ? "desc"
      : "asc";

  return [...rows].sort((a, b) => {
    const result = compareValues(
      a[column],
      b[column]
    );

    return direction === "desc"
      ? -result
      : result;
  });
}

function calculateAggregate(
  rows: Row[],
  column: string,
  operation: string
): number | null {
  if (operation === "count") {
    return rows.length;
  }

  const values = rows
    .map((row) =>
      normalizeNumber(row[column])
    )
    .filter(
      (value): value is number =>
        value !== null
    );

  if (values.length === 0) {
    return null;
  }

  switch (operation) {
    case "sum":
      return values.reduce(
        (total, value) =>
          total + value,
        0
      );

    case "average":
    case "avg":
      return (
        values.reduce(
          (total, value) =>
            total + value,
          0
        ) / values.length
      );

    case "min":
      return Math.min(...values);

    case "max":
      return Math.max(...values);

    default:
      throw new Error(
        `Unsupported aggregate operation: ${operation}`
      );
  }
}

function applyAggregation(
  rows: Row[],
  aggregate: unknown
) {
  if (!aggregate) {
    return null;
  }

  if (
    typeof aggregate !== "object" ||
    Array.isArray(aggregate)
  ) {
    throw new Error(
      "aggregate must be an object"
    );
  }

  const config =
    aggregate as Record<string, unknown>;

  const column = getString(
    config.column,
    "aggregate.column"
  );

  const operation = getString(
    config.operation,
    "aggregate.operation"
  ).toLowerCase();

  return {
    column,
    operation,
    value: calculateAggregate(
      rows,
      column,
      operation
    ),
  };
}

function applyGrouping(
  rows: Row[],
  groupBy: unknown
) {
  if (!groupBy) {
    return null;
  }

  const column = getString(
    groupBy,
    "group_by"
  );

  const groups = new Map<
    string,
    Row[]
  >();

  for (const row of rows) {
    const value = String(
      row[column] ?? ""
    );

    const existing = groups.get(value);

    if (existing) {
      existing.push(row);
    } else {
      groups.set(value, [row]);
    }
  }

  return Array.from(groups.entries()).map(
    ([value, groupRows]) => ({
      value,
      row_count: groupRows.length,
      rows: groupRows,
    })
  );
}

function escapeCsv(value: unknown): string {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  const stringValue = String(value);

  if (
    stringValue.includes(",") ||
    stringValue.includes('"') ||
    stringValue.includes("\n") ||
    stringValue.includes("\r")
  ) {
    return `"${stringValue.replace(
      /"/g,
      '""'
    )}"`;
  }

  return stringValue;
}

function rowsToCsv(rows: Row[]): string {
  const columns = getColumns(rows);

  if (columns.length === 0) {
    return "";
  }

  const header = columns
    .map(escapeCsv)
    .join(",");

  const body = rows.map((row) =>
    columns
      .map((column) =>
        escapeCsv(row[column])
      )
      .join(",")
  );

  return [header, ...body].join("\n");
}

function normalizeOutputFormat(
  value: unknown
): "json" | "csv" {
  if (
    typeof value === "string" &&
    value.toLowerCase() === "csv"
  ) {
    return "csv";
  }

  return "json";
}

export async function executeSpreadsheet(
  planStep: {
    input?: unknown;
  },
  context: SpreadsheetContext
) {
  getString(
    context.userId,
    "Authenticated user"
  );

  const input = extractInput(
    planStep.input
  );

  const rows = normalizeRows(
    input.data ?? input.rows
  );

  const originalRowCount = rows.length;

  let processedRows = rows;

  processedRows = applyFilter(
    processedRows,
    input.filter
  );

  processedRows = applySort(
    processedRows,
    input.sort
  );

  const aggregation =
    applyAggregation(
      processedRows,
      input.aggregate
    );

  const groups = applyGrouping(
    processedRows,
    input.group_by
  );

  if (
    processedRows.length >
    MAX_OUTPUT_ROWS
  ) {
    throw new Error(
      `Spreadsheet output exceeds the ${MAX_OUTPUT_ROWS.toLocaleString()} row limit`
    );
  }

  const outputFormat =
    normalizeOutputFormat(
      input.output_format
    );

  /*
   * ToolExecutionResult.output must be
   * Record<string, unknown>, so both CSV
   * and JSON results are wrapped inside
   * an object instead of returning a raw
   * string or array.
   */
  const output: Record<string, unknown> =
    outputFormat === "csv"
      ? {
          format: "csv",
          content: rowsToCsv(
            processedRows
          ),
        }
      : {
          format: "json",
          rows: processedRows,
        };

  return {
    success: true,
    operation:
      typeof input.operation === "string"
        ? input.operation
        : "process",
    original_row_count:
      originalRowCount,
    processed_row_count:
      processedRows.length,
    columns:
      getColumns(processedRows),
    aggregation,
    groups,
    output_format: outputFormat,
    output,
  };
}