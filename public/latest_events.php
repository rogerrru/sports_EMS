    <?php
function displayLatestEvents($conn)
{
    // Fetch the latest three events based on start date
    $sql = "SELECT e.*, s.startDate
            FROM events e
            JOIN schedules s ON e.scheduleID = s.scheduleID
            ORDER BY s.startDate DESC
            LIMIT 3";

    $result = $conn->query($sql);


    if ($result && $result->num_rows > 0) {
        while ($row = $result->fetch_assoc()) {
                echo '<div class="latestEvent">
                        <img src="data:image/jpeg;base64,' . $row["event_img"] . '" alt="' . htmlspecialchars($row["eventName"]) . '">
                            <div class="eventInfo">
                                <p>' . htmlspecialchars($row["eventStatus"]) . '</p>
                                <p>' . htmlspecialchars($row["startDate"]) . '</p>
                            </div>
                            <div class="eventName">' . htmlspecialchars($row["eventName"]) . '</div>
                        </div>';

        }
    } else {
        echo "No events found.";
    }
}
