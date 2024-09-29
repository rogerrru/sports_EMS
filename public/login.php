<?php
//require('./db.php');
session_start();
include 'db.php';
global $conn;
$conn = OpenCon();

if (isset($_POST['user']) && isset($_POST['password'])) {
    $email = trim($_POST['user']);
    $password = trim($_POST['password']);

    if (isset($_POST['remember'])) {
        // Set a cookie with the user information
        setcookie('user', $email, time() + (86400 * 30), "/"); // Cookie valid for 30 days
    }
    // Use prepared statement with a complete SELECT query
    $st = $conn->prepare("SELECT * FROM users WHERE email=? AND password=?");
    $st->bind_param('ss', $email, $password);

    // Execute the prepared statement
    $st->execute();

    // Get the result set
    $result = $st->get_result();

    // Check if there is a matching user
    if ($result->num_rows != 0) {
        $user = $result->fetch_assoc();
        $_SESSION['user'] = $email;
        $_SESSION['userDet'] = $user;
        $_SESSION['name'] = $user['firstName'];
        $_SESSION['userID'] = $user['userID'];
            if ($user['userType'] == 'user'){
            // Redirect to the index page
            header('Location: index.php');
            }else if ($user['userType'] == 'admin'){
            //log in the admin
            echo '
            <script>
             window.location.href = "http://localhost:3000/events";
            </script>';
            }
        echo "Successfully logged in!";
        exit();
    } else {
        echo '<script>
                alert("Invalid username or password");
                window.location.href = "/public/html/login_form.html";
              </script>';
    }

    // Close the statement
    $st->close();
} else {
    echo "Username and password are required";
}
?>
