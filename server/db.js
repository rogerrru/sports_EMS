require("dotenv").config();
const { Pool } = require("pg");

const isRemote =
  process.env.DATABASE_URL &&
  !process.env.DATABASE_URL.includes("localhost") &&
  !process.env.DATABASE_URL.includes("127.0.0.1");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isRemote ? { rejectUnauthorized: false } : false,
  options: "--search_path=sports_ems",
});

const PG_KEY_MAP = {
  eventid: "eventID", depid: "depID", orgid: "orgID", venueid: "venueID",
  scheduleid: "scheduleID", sessionid: "sessionID", userid: "userID",
  attendanceid: "attendanceID", eventregid: "eventRegID",
  eventname: "eventName", eventcategory: "eventCategory", eventstatus: "eventStatus",
  firstname: "firstName", lastname: "lastName", usertype: "userType",
  registrationdate: "registrationDate", attendancedatetime: "attendanceDateTime",
  depname: "depName", depdesc: "depDesc",
  orgname: "orgName", orgdesc: "orgDesc", sluorg: "SLUorg",
  venuename: "venueName", venueaddress: "venueAddress",
  startdate: "startDate", enddate: "endDate",
  sessiondesc: "sessionDesc", firstday: "firstDay", lastday: "lastDay",
  starttime: "startTime", endtime: "endTime",
  departmentname: "departmentName", departmentdesc: "departmentDesc",
  organizationname: "organizationName",
  sessionids: "sessionIDs", sessiondescs: "sessionDescs",
  firstdays: "firstDays", lastdays: "lastDays",
  starttimes: "startTimes", endtimes: "endTimes",
  attendanceids: "attendanceIDs", registrationids: "registrationIDs",
  eventnameattend: "eventNameAttend", eventnamereg: "eventNameReg",
  attendance: "attendance", registration: "registration",
};

function camelizeRows(rows) {
  return rows.map((row) => {
    const out = {};
    for (const [k, v] of Object.entries(row)) {
      out[PG_KEY_MAP[k.toLowerCase()] || k] = v;
    }
    return out;
  });
}

function mysqlToPg(sql) {
  // Strip MySQL backtick quoting (identifiers are unquoted in PG)
  let q = sql.replace(/`([^`]+)`/g, "$1");

  // ? → $1, $2, ...
  let n = 0;
  q = q.replace(/\?/g, () => `$${++n}`);

  // IFNULL → COALESCE
  q = q.replace(/\bIFNULL\b/gi, "COALESCE");

  // GROUP_CONCAT variants → STRING_AGG
  q = q.replace(
    /GROUP_CONCAT\(\s*DISTINCT\s+([^)]+?)\s+ORDER\s+BY\s+[^)]+?\s*\)/gi,
    (_, expr) => `STRING_AGG(DISTINCT CAST(${expr.trim()} AS TEXT), ',')`
  );
  q = q.replace(
    /GROUP_CONCAT\(\s*([^)]+?)\s+ORDER\s+BY\s+([^)]+?)\s*\)/gi,
    (_, expr, orderBy) =>
      `STRING_AGG(CAST(${expr.trim()} AS TEXT), ',' ORDER BY ${orderBy.trim()})`
  );
  q = q.replace(
    /GROUP_CONCAT\(\s*([^)]+?)\s*\)/gi,
    (_, expr) => `STRING_AGG(CAST(${expr.trim()} AS TEXT), ',')`
  );

  return q;
}

// MySQL2-compatible adapter so route code needs no changes
const connection = {
  connect(cb) {
    pool
      .query("SELECT 1")
      .then(() => { console.log("Connected to PostgreSQL"); cb && cb(null); })
      .catch((err) => { console.error("PostgreSQL connection error:", err); cb && cb(err); });
  },

  query(sql, paramsOrCb, cb) {
    let params = [];
    let callback = cb;
    if (typeof paramsOrCb === "function") {
      callback = paramsOrCb;
    } else {
      params = paramsOrCb || [];
    }

    let pgSql = mysqlToPg(sql);

    const trimmed = pgSql.trimStart().toUpperCase();
    if (trimmed.startsWith("INSERT") && !trimmed.includes("RETURNING")) {
      pgSql += " RETURNING *";
    }

    pool.query(pgSql, params, (err, result) => {
      if (err) return callback(err);

      const rows = camelizeRows(result.rows);

      if (trimmed.startsWith("INSERT") && rows.length > 0) {
        const idKey = Object.keys(rows[0]).find((k) => /ID$/.test(k));
        if (idKey) rows.insertId = rows[0][idKey];
      }

      callback(null, rows, result.fields);
    });
  },
};

// Promise-based query for use with async/await in routes
async function dbQuery(sql, params = []) {
  let pgSql = mysqlToPg(sql);
  const trimmed = pgSql.trimStart().toUpperCase();
  if (trimmed.startsWith("INSERT") && !trimmed.includes("RETURNING")) {
    pgSql += " RETURNING *";
  }
  const result = await pool.query(pgSql, params);
  const rows = camelizeRows(result.rows);
  if (trimmed.startsWith("INSERT") && rows.length > 0) {
    const idKey = Object.keys(rows[0]).find((k) => /ID$/.test(k));
    if (idKey) rows.insertId = rows[0][idKey];
  }
  return rows;
}

module.exports = { pool, connection, dbQuery };
