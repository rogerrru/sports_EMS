const express = require("express");
const bodyParser = require("body-parser");
const mysql = require("mysql2");
const cors = require("cors");
const multer = require("multer"); //install multer (npm i multer)
const fs = require("fs"); //install fs (npm i fs)
const path = require("path");

const connection = mysql.createConnection({
    //host: 'localhost' for webdev, host: 'mysql_db' for docker
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'dynamite-database'
});


connection.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL:', err);
    return;
  }
  console.log('Connected to MySQL');
});

//multer prereq for image handling
const storageOptions = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './assets/images') //location of saved imgs
  },
  filename:function (req, file, cb) {
    const eventId = req.params.eventId;
    const uniqueFileName = `event_${eventId}_${Date.now()}_${path.extname(file.originalname)}`;
    cb(null, uniqueFileName);
  }
});
const fileUpload = multer({
  storage: storageOptions
})

const app = express();
const port = 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static('assets'));
app.use('/node_modules', express.static('/server/node_modules'));
app.use('/styles', express.static('server/assets/styles'));
app.use('/scripts', express.static('server/assets/scripts'));
app.set('views', `${__dirname}/views`);
app.set('view engine', 'pug');
app.use(express.static('server'));

app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
const host = 'localhost';
app.listen(port, host);
console.log(`Server is listening on Port: ${port}`);


// viewing of events list
app.get('/events', (req, res) => {
  connection.query("SELECT * FROM events", (error, results, fields) => {
    if (error) {
      return res.status(500).json({ error: "Internal Server Error" });
    }

    res.render('events', { events: results });
  });
});

// searching an event
app.get('/searchEvent', (req, res) => {
  const searchTerm = req.query.search;

  const query = "SELECT * FROM events WHERE eventName LIKE ? OR description LIKE ? OR eventStatus LIKE ? OR eventCategory LIKE ?";
  const values = [`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`];

  connection.query(query, values, (error, results, fields) => {
    if (error) {
      return res.status(500).json({ error: "Internal Server Error" });
    }

    res.render('events', { events: results });
  });
});

// creating an event
app.get('/createEvent', (req, res) => {
  const departmentsQuery = "SELECT * FROM departments";
  const organizationsQuery = "SELECT * FROM organizations";
  const schedulesQuery = "SELECT * FROM schedules";
  const venuesQuery = "SELECT * FROM venues WHERE status = 'available'";

  connection.query(departmentsQuery, (errorD, departments, fieldsD) => {
    if (errorD) {
      return res.status(500).json({ error: "Internal Server Error" });
    }

    connection.query(organizationsQuery, (errorO, organizations, fieldsO) => {
      if (errorO) {
        return res.status(500).json({ error: "Internal Server Error" });
      }

      connection.query(schedulesQuery, (errorO, schedules, fieldsO) => {
        if (errorO) {
          return res.status(500).json({ error: "Internal Server Error" });
        }

      connection.query(venuesQuery, (errorO, venues, fieldsO) => {
        if (errorO) {
          return res.status(500).json({ error: "Internal Server Error" });
        }
          res.render('createEvent', {
            departments: departments,
            organizations: organizations,
            schedules: schedules,
            venues: venues,
          });
        });
      });
    });
  });
});


app.post('/createEvent', fileUpload.single('event_img'), (req, res) => {
  const { eventName, description, eventCategory, eventStatus, depID, orgID, venueID, scheduleID } = req.body;
  const event_img = req.file;

  if (!event_img) {
    return res.status(400).json({ error: 'No image uploaded' });
   }

   const imageFilePath = event_img.path;
   const imageFileData = fs.readFileSync(imageFilePath);

  fs.readFile(imageFilePath, (err, imageFileData) => {
    if (err) {
      return res.status(500).json({ error: 'Error reading the image file' });
    }

  // Convert the image file data to base64 encoding
  const base64Image = imageFileData.toString('base64');
  const query = `
    INSERT INTO events 
      (eventName, description, eventCategory, eventStatus, event_img, depID, orgID, venueID, scheduleID) 
    VALUES (?, ?, ?, ?, ?, IFNULL(?, depID), IFNULL(?, orgID), IFNULL(?, venueID), IFNULL(?, scheduleID))`;

  const values = [
    eventName,
    description,
    eventCategory,
    eventStatus,
    base64Image,
    depID || null,
    orgID || null,
    venueID || null,
    scheduleID || null
  ];

  connection.query(query, values, (error, results, fields) => {
    if (error) {
      return res.status(500).json({ error: 'Internal Server Error' });
    }
    const eventId = results.insertId;
    res.redirect(`/readEvent/${eventId}`);
  });
});
});

// reading an event's details
app.get('/readEvent/:eventId', (req, res) => {
  const eventId = req.params.eventId;

  const query = `
    SELECT
      events.*,
      departments.depName AS departmentName,
      departments.depDesc AS departmentDesc,
      organizations.orgName AS organizationName,
      venues.venueName AS venueName,
      venues.venueAddress AS venueAddress,
      schedules.startDate AS startDate,
      schedules.endDate as endDate,
      GROUP_CONCAT(sessions.sessionID ORDER BY sessions.sessionID) AS sessionIDs,
      GROUP_CONCAT(sessions.sessionDesc ORDER BY sessions.sessionID) AS sessionDescs,
      GROUP_CONCAT(sessions.firstDay ORDER BY sessions.sessionID) AS firstDays,
      GROUP_CONCAT(sessions.lastDay ORDER BY sessions.sessionID) AS lastDays,
      GROUP_CONCAT(sessions.startTime ORDER BY sessions.sessionID) AS startTimes,
      GROUP_CONCAT(sessions.endTime ORDER BY sessions.sessionID) AS endTimes
    FROM
      events
      LEFT JOIN departments ON events.depID = departments.depID
      LEFT JOIN organizations ON events.orgID = organizations.orgID
      LEFT JOIN venues ON events.venueID = venues.venueID
      LEFT JOIN schedules ON events.scheduleID = schedules.scheduleID
      LEFT JOIN sessions ON events.eventID = sessions.eventID
    WHERE
      events.eventID = ?
    GROUP BY
      events.eventID;
  `;

  connection.query(query, [eventId], (error, results, fields) => {
    if (error) {
      return res.status(500).json({ error: "Internal Server Error" });
    }

    const event = results[0];
    if (event) {
      event.sessionIDs = event.sessionIDs ? event.sessionIDs.split(',') : [];
      event.sessionDescs = event.sessionDescs ? event.sessionDescs.split(',') : [];
      event.firstDays = event.firstDays ? event.firstDays.split(',') : [];
      event.lastDays = event.lastDays ? event.lastDays.split(',') : [];
      event.startTimes = event.startTimes ? event.startTimes.split(',') : [];
      event.endTimes = event.endTimes ? event.endTimes.split(',') : [];
    }

    res.render('readEvent', { event });
  });
});

// updating an event's details
app.get('/updateEvent/:eventId', (req, res) => {
  const eventId = req.params.eventId;

  const departmentsQuery = "SELECT * FROM departments";
  const organizationsQuery = "SELECT * FROM organizations";
  const schedulesQuery = "SELECT * FROM schedules";
  const venuesQuery = "SELECT * FROM venues";
  const eventsQuery = `
        SELECT
        events.*,
        departments.depName AS departmentName,
        departments.depDesc AS departmentDesc,
        organizations.orgName AS organizationName,
        venues.venueName AS venueName,
        venues.venueAddress AS venueAddress,
        schedules.startDate AS startDate,
        schedules.endDate as endDate,
        GROUP_CONCAT(sessions.sessionID ORDER BY sessions.sessionID) AS sessionIDs,
        GROUP_CONCAT(sessions.sessionDesc ORDER BY sessions.sessionID) AS sessionDescs,
        GROUP_CONCAT(sessions.firstDay ORDER BY sessions.sessionID) AS firstDays,
        GROUP_CONCAT(sessions.lastDay ORDER BY sessions.sessionID) AS lastDays,
        GROUP_CONCAT(sessions.startTime ORDER BY sessions.sessionID) AS startTimes,
        GROUP_CONCAT(sessions.endTime ORDER BY sessions.sessionID) AS endTimes
      FROM
        events
        LEFT JOIN departments ON events.depID = departments.depID
        LEFT JOIN organizations ON events.orgID = organizations.orgID
        LEFT JOIN venues ON events.venueID = venues.venueID
        LEFT JOIN schedules ON events.scheduleID = schedules.scheduleID
        LEFT JOIN sessions ON events.eventID = sessions.eventID
      WHERE
        events.eventID = ?
      GROUP BY
        events.eventID;
    `;

  connection.query(departmentsQuery, (errorD, departments, fieldsD) => {
    if (errorD) {
      return res.status(500).json({ error: "Internal Server Error" });
    }

    connection.query(organizationsQuery, (errorO, organizations, fieldsO) => {
      if (errorO) {
        return res.status(500).json({ error: "Internal Server Error" });
      }

      connection.query(schedulesQuery, (errorO, schedules, fieldsO) => {
        if (errorO) {
          return res.status(500).json({ error: "Internal Server Error" });
        }

      connection.query(venuesQuery, (errorO, venues, fieldsO) => {
        if (errorO) {
          return res.status(500).json({ error: "Internal Server Error" });
        }

        connection.query(eventsQuery, [eventId], (errorE, results, fieldsE) => {
          if (errorE) {
            return res.status(500).json({ error: "Internal Server Error" });
          }

            const events = results[0];
            if (events) {
              events.sessionIDs = events.sessionIDs ? events.sessionIDs.split(',') : [];
              events.sessionDescs = events.sessionDescs ? events.sessionDescs.split(',') : [];
              events.firstDays = events.firstDays ? events.firstDays.split(',') : [];
              events.lastDays = events.lastDays ? events.lastDays.split(',') : [];
              events.startTimes = events.startTimes ? events.startTimes.split(',') : [];
              events.endTimes = events.endTimes ? events.endTimes.split(',') : [];
            }

            res.render('updateEvent', {
              event: events,
              departments: departments,
              organizations: organizations,
              schedules: schedules,
              venues: venues,
         });
        });
        });
      });
    });
  });
});

app.post('/updateEvent/:eventId', fileUpload.single('event_img'), (req, res) => {
  const eventId = req.params.eventId;
  const { eventName, description, eventStatus, eventCategory, depID, orgID, venueID } = req.body;
  const event_img = req.file;

  const updateEventQuery = 'UPDATE events SET eventName = ?, description = ?, eventStatus = ?, eventCategory = ?, event_img = ?, depID = ?, orgID = ?, venueID = ? WHERE eventID = ?';

  if (event_img) {
    const imageFilePath = event_img.path;
    const imageFileData = fs.readFileSync(imageFilePath);

    // Convert the image file data to base64 encoding
    base64Image = imageFileData.toString('base64');
  }
  
  // Check if depID, orgID, venueID are provided and set them accordingly
  const updateEventValues = [
    eventName,
    description,
    eventStatus,
    eventCategory,
    base64Image, 
    depID || null,
    orgID || null,
    venueID || null,
    eventId
  ];

  connection.query(updateEventQuery, updateEventValues, (error, results, fields) => {
    if (error) {
      return res.status(500).json({ error: 'Internal Server Error' });
    }

    const readQuery = `
      SELECT
        events.*,
        departments.depName AS departmentName,
        departments.depDesc AS departmentDesc,
        organizations.orgName AS organizationName,
        venues.venueName AS venueName,
        venues.venueAddress AS venueAddress,
        schedules.startDate AS startDate,
        schedules.endDate as endDate,
        GROUP_CONCAT(sessions.sessionID ORDER BY sessions.sessionID) AS sessionIDs,
        GROUP_CONCAT(sessions.sessionDesc ORDER BY sessions.sessionID) AS sessionDescs,
        GROUP_CONCAT(sessions.firstDay ORDER BY sessions.sessionID) AS firstDays,
        GROUP_CONCAT(sessions.lastDay ORDER BY sessions.sessionID) AS lastDays,
        GROUP_CONCAT(sessions.startTime ORDER BY sessions.sessionID) AS startTimes,
        GROUP_CONCAT(sessions.endTime ORDER BY sessions.sessionID) AS endTimes
      FROM
        events
        LEFT JOIN departments ON events.depID = departments.depID
        LEFT JOIN organizations ON events.orgID = organizations.orgID
        LEFT JOIN venues ON events.venueID = venues.venueID
        LEFT JOIN schedules ON events.scheduleID = schedules.scheduleID
        LEFT JOIN sessions ON events.eventID = sessions.eventID
      WHERE
        events.eventID = ?
      GROUP BY
        events.eventID;
    `;

    connection.query(readQuery, [eventId], (readError, readResults, readFields) => {
      if (readError) {
        return res.status(500).json({ error: 'Internal Server Error' });
      }

      const updatedEvent = readResults[0];
      if (updatedEvent) {
        updatedEvent.sessionIDs = updatedEvent.sessionIDs ? updatedEvent.sessionIDs.split(',') : [];
        updatedEvent.sessionDescs = updatedEvent.sessionDescs ? updatedEvent.sessionDescs.split(',') : [];
        updatedEvent.firstDays = updatedEvent.firstDays ? updatedEvent.firstDays.split(',') : [];
        updatedEvent.lastDays = updatedEvent.lastDays ? updatedEvent.lastDays.split(',') : [];
        updatedEvent.startTimes = updatedEvent.startTimes ? updatedEvent.startTimes.split(',') : [];
        updatedEvent.endTimes = updatedEvent.endTimes ? updatedEvent.endTimes.split(',') : [];
      }

      res.render('readEvent', { event: updatedEvent });
    });
  });
});

// deleting an event
app.get('/deleteEvent/:eventId', (req, res) => {
  const eventId = req.params.eventId;

  connection.query("DELETE FROM events WHERE eventID = ?", [eventId], (error, results, fields) => {
    if (error) {
      return res.status(500).json({ error: "Internal Server Error" });
    }

    res.redirect('/events');
  });
});

// viewing session participants
app.get('/events/:eventId/sessions/:sessionId/participants', (req, res) => {
  const sessionId = req.params.sessionId;

  const query = `
    SELECT
      event_attendance.*,
      users.firstName,
      users.lastName
    FROM
      event_attendance
      INNER JOIN users ON event_attendance.userID = users.userID
    WHERE
      event_attendance.sessionID = ?
    ORDER BY
      users.lastName;
  `;

  connection.query(query, [sessionId], (error, results, fields) => {
    if (error) {
      return res.status(500).json({ error: "Internal Server Error" });
    }

    res.render('sessionParticipants', { participants: results });
  });
});

// viewing of departments list
app.get('/departments', (req, res) => {
  connection.query("SELECT * FROM departments", (error, results, fields) => {
    if (error) {
      return res.status(500).json({ error: "Internal Server Error" });
    }

    res.render('departments', { departments: results });
  });
});

// searching a department
app.get('/searchDepartment', (req, res) => {
  const searchTerm = req.query.search;

  const query = "SELECT * FROM departments WHERE depName LIKE ? OR depDesc LIKE ?";
  const values = [`%${searchTerm}%`, `%${searchTerm}%`];

  connection.query(query, values, (error, results, fields) => {
    if (error) {
      return res.status(500).json({ error: "Internal Server Error" });
    }

    res.render('departments', { departments: results });
  });
});

// creating a department
app.get('/createDepartment', (req, res) => {
  res.render('createDepartment');
});

app.post('/createDepartment', (req, res) => {
  const { depName, depDesc } = req.body;

  const query = 'INSERT INTO departments (depName, depDesc) VALUES (?, ?)';
  const values = [depName, depDesc];

  connection.query(query, values, (error, results, fields) => {
    if (error) {
      return res.status(500).json({ error: 'Internal Server Error' });
    }

    res.redirect('departments');
  });
});

// updating a department
app.get('/updateDepartment/:depId', (req, res) => {
  const depId = req.params.depId;

  connection.query("SELECT * FROM departments WHERE depID = ?", [depId], (error, results, fields) => {
    if (error) {
      return res.status(500).json({ error: "Internal Server Error" });
    }

    res.render('updateDepartment', { department: results[0] });
  });
});

app.post('/updateDepartment/:depId', (req, res) => {
  const depId = req.params.depId;
  const { depName, depDesc } = req.body;

  const query = 'UPDATE departments SET depName = ?, depDesc = ? WHERE depID = ?';
  const values = [depName, depDesc, depId];

  connection.query(query, values, (error, results, fields) => {
    if (error) {
      return res.status(500).json({ error: 'Internal Server Error' });
    }

    res.redirect('/departments');
  });
});

// deleting a department
app.get('/deleteDepartment/:depId', (req, res) => {
  const depId = req.params.depId;

  connection.query("DELETE FROM departments WHERE depID = ?", [depId], (error, results, fields) => {
    if (error) {
      return res.status(500).json({ error: "Internal Server Error" });
    }

    res.redirect('/departments');
  });
});

// viewing of organizations list
app.get('/organizations', (req, res) => {
   connection.query("SELECT * FROM organizations", (error, results, fields) => {
     if (error) {
       return res.status(500).json({ error: "Internal Server Error" });
     }

     res.render('organizations', { organizations: results });
   });
});

// searching an organization
app.get('/searchOrganization', (req, res) => {
   const searchTerm = req.query.search;

   const query = "SELECT * FROM organizations WHERE orgName LIKE ?";
   const values = [`%${searchTerm}%`];

   connection.query(query, values, (error, results, fields) => {
     if (error) {
       return res.status(500).json({ error: "Internal Server Error" });
     }

     res.render('organizations', { organizations: results });
   });
});

// creating an organization
app.get('/createOrganization', (req, res) => {
   res.render('createOrganization');
 });

 app.post('/createOrganization', (req, res) => {
   const { orgName, SLUorg } = req.body;

   const query = 'INSERT INTO organizations (orgName, SLUorg) VALUES (?, ?)';
   const values = [orgName, SLUorg];

   connection.query(query, values, (error, results, fields) => {
     if (error) {
       return res.status(500).json({ error: 'Internal Server Error' });
     }

     res.redirect('organizations');
   });
});

 // updating an organization
app.get('/updateOrganization/:orgId', (req, res) => {
  const orgId = req.params.orgId;

  connection.query("SELECT * FROM organizations WHERE orgID = ?", [orgId], (error, results, fields) => {
    if (error) {
      return res.status(500).json({ error: "Internal Server Error" });
    }

    res.render('updateOrganization', { organization: results[0] });
  });
});

app.post('/updateOrganization/:orgId', (req, res) => {
  const orgId = req.params.orgId;
  const { orgName, SLUorg } = req.body;

  const query = 'UPDATE organizations SET orgName = ?, SLUorg = ? WHERE orgID = ?';
  const values = [orgName, SLUorg, orgId];

  connection.query(query, values, (error, results, fields) => {
    if (error) {
      return res.status(500).json({ error: 'Internal Server Error' });
    }

    res.redirect('/organizations');
  });
});

// deleting an organization
app.get('/deleteOrganization/:orgId', (req, res) => {
  const orgId = req.params.orgId;

  connection.query("DELETE FROM organizations WHERE orgID = ?", [orgId], (error, results, fields) => {
    if (error) {
      return res.status(500).json({ error: "Internal Server Error" });
    }

    res.redirect('/organizations');
  });
});

// viewing of user accounts list
app.get('/users', (req, res) => {
  connection.query("SELECT * FROM users", (error, results, fields) => {
    if (error) {
      return res.status(500).json({ error: "Internal Server Error" });
    }

    res.render('users', { users: results });
  });
});

// searching a user account
app.get('/searchUser', (req, res) => {
   const searchTerm = req.query.search;

   const query = "SELECT * FROM users WHERE firstname LIKE ? OR lastname LIKE ? OR email LIKE ?";
   const values = [`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`];

   connection.query(query, values, (error, results, fields) => {
     if (error) {
       return res.status(500).json({ error: "Internal Server Error" });
     }

     res.render('users', { users: results });
   });
});

// creating a user account
app.get('/createUser', (req, res) => {
   res.render('createUser');
 });

app.post('/createUser', (req, res) => {
   const { firstName, lastName, email, password } = req.body;

   const query = 'INSERT INTO users (firstName, lastName, email, password) VALUES (?, ?, ?, ?)';
   const values = [firstName, lastName, email, password];

   connection.query(query, values, (error, results, fields) => {
     if (error) {
       return res.status(500).json({ error: 'Internal Server Error' });
     }

     res.redirect('users');
   });
});

 // deleting a user account
app.get('/deleteUser/:userId', (req, res) => {
   const userId = req.params.userId;

   connection.query("DELETE FROM users WHERE userID = ?", [userId], (error, results, fields) => {
     if (error) {
       return res.status(500).json({ error: "Internal Server Error" });
     }

     res.redirect('/users');
   });
});

// creating a session
app.get('/createSession/:eventId', (req, res) => {
  const eventId = req.params.eventId;

  connection.query("SELECT schedules.* FROM `events` LEFT JOIN schedules ON events.scheduleID = schedules.scheduleID WHERE eventID = ?", [eventId], (error, schedules, fields) => {
    if (error) {
      return res.status(500).json({ error: "Internal Server Error" });
    }

    connection.query("SELECT * FROM sessions WHERE eventID = ?", [eventId], (error, sessions, fields) => {
      if (error) {
        return res.status(500).json({ error: "Internal Server Error" });
      }

    res.render('createSession', { event: { eventID: eventId }, schedules, sessions });
  });
});
})

app.post('/createSession/:eventId', (req, res) => {
  const eventId = req.params.eventId;
  const { sessionDesc, firstDay, lastDay, startTime, endTime } = req.body;

  const query = 'INSERT INTO sessions (eventID, sessionDesc, firstDay, lastDay, startTime, endTime) VALUES (?, ?, ?, ?, ?, ?)';
  const values = [eventId, sessionDesc, firstDay, lastDay, startTime, endTime];

  connection.query(query, values, (error, results, fields) => {
    if (error) {
      return res.status(500).json({ error: 'Internal Server Error' });
    }

    const readQuery = `
      SELECT
        events.*,
        departments.depName AS departmentName,
        departments.depDesc AS departmentDesc,
        organizations.orgName AS organizationName,
        venues.venueName AS venueName,
        venues.venueAddress AS venueAddress,
        schedules.startDate AS startDate,
        schedules.endDate as endDate,
        GROUP_CONCAT(sessions.sessionID ORDER BY sessions.sessionID) AS sessionIDs,
        GROUP_CONCAT(sessions.sessionDesc ORDER BY sessions.sessionID) AS sessionDescs,
        GROUP_CONCAT(sessions.firstDay ORDER BY sessions.sessionID) AS firstDays,
        GROUP_CONCAT(sessions.lastDay ORDER BY sessions.sessionID) AS lastDays,
        GROUP_CONCAT(sessions.startTime ORDER BY sessions.sessionID) AS startTimes,
        GROUP_CONCAT(sessions.endTime ORDER BY sessions.sessionID) AS endTimes
      FROM
        events
        LEFT JOIN departments ON events.depID = departments.depID
        LEFT JOIN organizations ON events.orgID = organizations.orgID
        LEFT JOIN venues ON events.venueID = venues.venueID
        LEFT JOIN schedules ON events.scheduleID = schedules.scheduleID
        LEFT JOIN sessions ON events.eventID = sessions.eventID
      WHERE
        events.eventID = ?
      GROUP BY
        events.eventID;
    `;

    connection.query(readQuery, [eventId], (readError, readResults, readFields) => {
      if (readError) {
        return res.status(500).json({ error: 'Internal Server Error' });
      }

      const updatedEvent = readResults[0];
      if (updatedEvent) {
        updatedEvent.sessionIDs = updatedEvent.sessionIDs ? updatedEvent.sessionIDs.split(',') : [];
        updatedEvent.sessionDescs = updatedEvent.sessionDescs ? updatedEvent.sessionDescs.split(',') : [];
        updatedEvent.firstDays = updatedEvent.firstDays ? updatedEvent.firstDays.split(',') : [];
        updatedEvent.lastDays = updatedEvent.lastDays ? updatedEvent.lastDays.split(',') : [];
        updatedEvent.startTimes = updatedEvent.startTimes ? updatedEvent.startTimes.split(',') : [];
        updatedEvent.endTimes = updatedEvent.endTimes ? updatedEvent.endTimes.split(',') : [];
      }

      res.render('readEvent', { event: updatedEvent });
  });
});
});

// updating a session
app.get('/updateSession/:eventId/:sessionId', (req, res) => {
  const eventId = req.params.eventId;
  const sessionId = req.params.sessionId;

  connection.query("SELECT * FROM sessions WHERE eventID = ? AND sessionID = ?", [eventId, sessionId], (error, results, fields) => {
    if (error) {
      return res.status(500).json({ error: "Internal Server Error" });
    }

  connection.query("SELECT schedules.* FROM events LEFT JOIN schedules ON events.scheduleID = schedules.scheduleID WHERE eventID = ?", [eventId], (error, schedules, fields) => {
    if (error) {
      return res.status(500).json({ error: "Internal Server Error" });
    }

    res.render('updateSession', { event: { eventID: eventId }, session: results[0], schedules });
  });
});
});

app.post('/updateSession/:eventId/:sessionId', (req, res) => {
  const eventId = req.params.eventId;
  const sessionId = req.params.sessionId;
  const { sessionDesc, firstDay, lastDay, startTime, endTime } = req.body;

  const query = 'UPDATE sessions SET sessionDesc = ?, firstDay = ?, lastDay = ?, startTime = ?, endTime = ? WHERE eventID = ? AND sessionID = ?';
  const values = [sessionDesc, firstDay, lastDay, startTime, endTime, eventId, sessionId];

  connection.query(query, values, (error, results, fields) => {
    if (error) {
      return res.status(500).json({ error: 'Internal Server Error' });
    }

    res.redirect(`/updateEvent/${eventId}`);
  });
});

// deleting a session
app.get('/deleteSession/:eventId/:sessionId', (req, res) => {
  const eventId = req.params.eventId;
  const sessionId = req.params.sessionId;

  connection.query("DELETE FROM sessions WHERE sessionID = ?", [sessionId], (error, results, fields) => {
    if (error) {
      return res.status(500).json({ error: "Internal Server Error" });
    }

    res.redirect(`/updateEvent/${eventId}`);
  });
});

// creating a schedule
app.get('/createSchedule', (req, res) => {
    res.render('createSchedule');
});

app.post('/createSchedule', (req, res) => {
  const source = req.query.source;
  const eventId = req.body.eventId;
  const { duration, startDate, endDate } = req.body;

  const query = 'INSERT INTO schedules(duration, startDate, endDate) VALUES (?,?,?)';
  const values = [duration, startDate, endDate];

  connection.query(query, values, (error, results, fields) => {
    if (error) {
      return res.status(500).json({ error: 'Internal Server Error' });
    }
      res.redirect('/events');
  });
});

// creating a venue
app.get('/createVenue', (req, res) => {
    res.render('createVenue');
});

app.post('/createVenue', (req, res) => {
  const source = req.query.source;
  const eventId = req.body.eventId;
  const { venueName, venueAddress, status } = req.body;

  const query = 'INSERT INTO venues(venueName, venueAddress, status) VALUES (?,?,"available")';
  const values = [venueName, venueAddress, status];

  connection.query(query, values, (error, results, fields) => {
    if (error) {
      return res.status(500).json({ error: 'Internal Server Error' });
    }
      res.redirect('/events');
  });
});

app.get('/readUser/:userId', (req, res) => {
  const userId = req.params.userId;
  const query = `
    SELECT
      users.*,
      GROUP_CONCAT(DISTINCT event_attend.attendanceID ORDER BY event_attend.attendanceID) AS attendanceIDs,
      GROUP_CONCAT(DISTINCT event_attend.attendanceDateTime ORDER BY event_attend.attendanceID) AS attendance,
      GROUP_CONCAT(DISTINCT event_reg.eventRegID ORDER BY event_reg.eventRegID) AS registrationIDs,
      GROUP_CONCAT(DISTINCT event_reg.registrationDate ORDER BY  event_reg.eventRegID) AS registration,
      GROUP_CONCAT(DISTINCT events_attend.eventName ORDER BY event_attend.attendanceID) AS eventNameAttend,
      GROUP_CONCAT(DISTINCT events_reg.eventName ORDER BY event_reg.eventRegID) AS eventNameReg,
      departments.depName AS departmentName,
      departments.depDesc AS departmentDesc,
      organizations.orgName AS organizationName
    FROM
      users
        LEFT JOIN
      event_attendance event_attend ON event_attend.userID = users.userID
        LEFT JOIN
      event_reg ON event_reg.userID = users.userID
        LEFT JOIN
      events events_attend ON event_attend.eventID = events_attend.eventID
        LEFT JOIN
      events events_reg ON event_reg.eventID = events_reg.eventID
        LEFT JOIN
      departments ON users.depID = departments.depID
        LEFT JOIN
      organizations ON users.orgID = organizations.orgID
    WHERE
      users.userID = ?
    GROUP BY
      users.userID;`;

  connection.query(query, [userId], (error, results, fields) => {
    if (error) {
      return res.status(500).json({ error: "Internal Server Error" });
    }

    const user = results[0];
    if (user) {
      user.attendanceIDs = user.attendanceIDs ? user.attendanceIDs.split(',') : [];
      user.attendance = user.attendance ? user.attendance.split(',') : [];
      user.eventNameAttend = user.eventNameAttend ? user.eventNameAttend.split(',') : [];
      user.registrationIDs = user.registrationIDs ? user.registrationIDs.split(',') : [];
      user.registration = user.registration ? user.registration.split(',') : [];
      user.eventNameReg = user.eventNameReg ? user.eventNameReg.split(',') : [];
    }

    res.render('readUser', { user });
  });
});

// updating an user's details
app.get('/updateUser/:userId', (req, res) => {
  const userId = req.params.userId;

  const departmentsQuery = "SELECT * FROM departments";
  const organizationsQuery = "SELECT * FROM organizations";
  const usersQuery = `
  SELECT 
  users.*, 
  GROUP_CONCAT(event_attend.attendanceID ORDER BY event_attend.attendanceID) AS attendanceIDs,
  GROUP_CONCAT(event_attend.attendanceDateTime ORDER BY event_attend.attendanceID) AS attendance,
  GROUP_CONCAT(event_reg.eventRegID ORDER BY event_reg.eventRegID) AS registrationIDs,
  GROUP_CONCAT(event_reg.registrationDate ORDER BY  event_reg.eventRegID) AS registration,
  GROUP_CONCAT(events_attend.eventName ORDER BY event_attend.attendanceID) AS eventNameAttend,
  GROUP_CONCAT(events_reg.eventName ORDER BY event_reg.eventRegID) AS eventNameReg,
  departments.depName AS departmentName,
  departments.depDesc AS departmentDesc,
  organizations.orgName AS organizationName
  FROM 
  users 
  LEFT JOIN 
  event_attendance event_attend ON event_attend.userID = users.userID
  LEFT JOIN 
  event_reg ON event_reg.userID = users.userID
  LEFT JOIN 
  events events_attend ON event_attend.eventID = events_attend.eventID
  LEFT JOIN 
  events events_reg ON event_reg.eventID = events_reg.eventID
  LEFT JOIN 
  departments ON users.depID = departments.depID
  LEFT JOIN 
  organizations ON users.orgID = organizations.orgID
  WHERE 
  users.userID = ?;
  `;

  connection.query(departmentsQuery, (errorD, departments, fieldsD) => {
    if (errorD) {
      return res.status(500).json({ error: "Internal Server Error" });
    }

    connection.query(organizationsQuery, (errorO, organizations, fieldsO) => {
      if (errorO) {
        return res.status(500).json({ error: "Internal Server Error" });
      }

      connection.query(usersQuery, [userId], (errorO, results, fieldsO) => {
        if (errorO) {
          return res.status(500).json({ error: "Internal Server Error" });
        }

        const userDetails = results[0];
        if (userDetails) {
          userDetails.attendanceIDs = userDetails.attendanceIDs ? userDetails.attendanceIDs.split(',') : [];
          userDetails.attendance = userDetails.attendance ? userDetails.attendance.split(',') : [];
          userDetails.eventNameAttend = userDetails.eventNameAttend ? userDetails.eventNameAttend.split(',') : [];
          userDetails.registrationIDs = userDetails.registrationIDs ? userDetails.registrationIDs.split(',') : [];
          userDetails.registration = userDetails.registration ? userDetails.registration.split(',') : [];
          userDetails.eventNameReg = userDetails.eventNameReg ? userDetails.eventNameReg.split(',') : [];
        }

            res.render('updateUser', {
              user: userDetails,
              departments: departments,
              organizations: organizations,
         });
      });
    });
  });
});

app.post('/updateUser/:userId', (req, res) => {
  const userId = req.params.userId;
  const { firstName, lastName, password, email, userType, depID, orgID } = req.body;

  const updateUserQuery = 'UPDATE users SET firstName = ?, lastName = ?, password = ?, email = ?, userType = ?, depID = IFNULL(?, depID), orgID = IFNULL(?, orgID) WHERE userID = ?';
  const updateUserValues = [firstName, lastName, password, email, userType, depID || null, orgID || null, userId];

  connection.query(updateUserQuery, updateUserValues, (error, results, fields) => {
    if (error) {
      return res.status(500).json({ error: 'Internal Server Error' });
    }

    const readQuery = `
    SELECT 
    users.*, 
    GROUP_CONCAT(event_attend.attendanceID ORDER BY event_attend.attendanceID) AS attendanceIDs,
    GROUP_CONCAT(event_attend.attendanceDateTime ORDER BY event_attend.attendanceID) AS attendance,
    GROUP_CONCAT(event_reg.eventRegID ORDER BY event_reg.eventRegID) AS registrationIDs,
    GROUP_CONCAT(event_reg.registrationDate ORDER BY  event_reg.eventRegID) AS registration,
    GROUP_CONCAT(events_attend.eventName ORDER BY event_attend.attendanceID) AS eventNameAttend,
    GROUP_CONCAT(events_reg.eventName ORDER BY event_reg.eventRegID) AS eventNameReg,
    departments.depName AS departmentName,
    departments.depDesc AS departmentDesc,
    organizations.orgName AS organizationName
    FROM 
    users 
    LEFT JOIN 
    event_attendance event_attend ON event_attend.userID = users.userID
    LEFT JOIN 
    event_reg ON event_reg.userID = users.userID
    LEFT JOIN 
    events events_attend ON event_attend.eventID = events_attend.eventID
    LEFT JOIN 
    events events_reg ON event_reg.eventID = events_reg.eventID
    LEFT JOIN 
    departments ON users.depID = departments.depID
    LEFT JOIN 
    organizations ON users.orgID = organizations.orgID
    WHERE 
    users.userID = ?;
    `;

    connection.query(readQuery, [userId], (error, readResults, fields) => {
      if (error) {
        return res.status(500).json({ error: "Internal Server Error" });
      }

      const userDetails = readResults[0];
      if (userDetails) {
        userDetails.attendanceIDs = userDetails.attendanceIDs ? userDetails.attendanceIDs.split(',') : [];
        userDetails.attendance = userDetails.attendance ? userDetails.attendance.split(',') : [];
        userDetails.eventNameAttend = userDetails.eventNameAttend ? userDetails.eventNameAttend.split(',') : [];
        userDetails.registrationIDs = userDetails.registrationIDs ? userDetails.registrationIDs.split(',') : [];
        userDetails.registration = userDetails.registration ? userDetails.registration.split(',') : [];
        userDetails.eventNameReg = userDetails.eventNameReg ? userDetails.eventNameReg.split(',') : [];
      }

      res.render('readUser', { user: userDetails });
    });
  });
});

// deleting a user
app.get('/deleteUser/:userId', (req, res) => {
  const userId = req.params.userId;

  connection.query("DELETE FROM users WHERE userID = ?", [userId], (error, results, fields) => {
    if (error) {
      return res.status(500).json({ error: "Internal Server Error" });
    }

    res.redirect(`users`);
  });
});

// to be changed
function landingPage(){
  app.get('/events', (req, res) => {
    connection.query("SELECT * FROM events", (error, results, fields) => {
      if (error) {
        return res.status(500).json({ error: "Internal Server Error" });
      }

      res.render('events', { events: results });
    });
  });
}

// Parse URL-encoded bodies (as sent by HTML forms)
app.use(bodyParser.urlencoded({ extended: true }));

app.post('/processQRCode/:eventId/:sessionId', (req, res) => {
  try {
    const qrCodeData = req.body.qrCodeData;
    const qrCodeObject = JSON.parse(qrCodeData);
    const eventIDFromQR = qrCodeObject.eventID;
    const sessionId = req.params.sessionId;
    const userId = qrCodeObject.userID;

    // Check if the event ID from the QR code matches the event ID in the session
    if (eventIDFromQR !== req.params.eventId) {
      console.error('Error: Event ID mismatch');
      return res.status(400).send('Bad Request - Event ID mismatch');
    }

    const insertQuery = 'INSERT INTO event_attendance (eventID, userID, sessionID, attendanceDateTime) VALUES (?, ?, ?, NOW())';
    const values = [eventIDFromQR, userId, sessionId];

    connection.query(insertQuery, values, (error, results) => {
      if (error) {
        console.error('Error inserting into the database:', error);
        res.status(500).send('Internal Server Error');
      } else {
        console.log('Inserted into the database successfully');
        res.send('QR code data received and inserted into the database');
      }
    });
  } catch (error) {
    console.error('Error processing QR code data:', error);
    res.status(400).send('Bad Request');
  }
});


app.get('/scanner/:eventID/:sessionID', (req, res) => {
  const eventID = req.params.eventID;
  const sessionID = req.params.sessionID;

  const querySession = `
    SELECT
      sessions.sessionID,
      sessions.eventID,
      sessions.scheduleID,
      sessions.sessionDesc,
      sessions.firstDay,
      sessions.lastDay,
      sessions.startTime,
      sessions.endTime,
      events.eventName,
      events.description AS eventDescription,
      events.eventStatus,
      events.eventCategory,
      departments.depName AS departmentName,
      organizations.orgName AS organizationName
    FROM
      sessions
        LEFT JOIN events ON sessions.eventID = events.eventID
        LEFT JOIN departments ON events.depID = departments.depID
        LEFT JOIN organizations ON events.orgID = organizations.orgID
    WHERE
      sessions.eventID = ? AND sessions.sessionID = ?
  `;

  const queryAttendance = `
      SELECT
      event_attendance.attendanceID,
      event_attendance.attendanceDateTime,
      users.firstName AS firstName,
      users.lastName AS lastName
    FROM
      event_attendance
      LEFT JOIN events ON event_attendance.eventID = events.eventID
      LEFT JOIN users ON event_attendance.userID = users.userID
      LEFT JOIN sessions ON event_attendance.sessionID = sessions.sessionID
    WHERE
    events.eventID = ? AND sessions.sessionID = ?;
  `;

  connection.query(querySession, [eventID, sessionID], (error, resultsSession, fields) => {
    if (error) {
      return res.status(500).json({ error: "Internal Server Error" });
    }

    const session = resultsSession[0];

      connection.query(queryAttendance, [eventID, sessionID], (error, resultsAttendance, fields) => {
        if (error) {
          return res.status(500).json({ error: "Internal Server Error" });
        }

        res.render('scanner', { session, eventAttendance: resultsAttendance });
      });
    });
  });

