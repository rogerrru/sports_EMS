<?php
session_start();
require('db.php');
$conn = OpenCon();
require_once __DIR__ . '/../vendor/autoload.php';
use Endroid\QrCode\QrCode;
use Endroid\QrCode\Writer\PngWriter;
$user_info = [
    'userID' => $_SESSION['userID'],
    'registrationID' => $_SESSION['eventRegID'],
    'eventID' => $_SESSION['eventID']
];

// Convert the array to a JSON string
$json_data = json_encode($user_info);

// Create the QR code with the JSON string
$qr_code = QrCode::create($json_data);
$writer = new PngWriter();
$result = $writer->write($qr_code);
$qr_image_data = $result->getDataUri();

// Saving the data in the user_qr table along with the QR code image
$stmt = $conn->prepare("INSERT INTO user_qr (userID, registrationID, eventID, qr_img) VALUES (?, ?, ?, ?)");
$stmt->bind_param('iiss', $_SESSION['userID'], $_SESSION['eventRegID'], $_SESSION['eventID'], $qr_image_data);
$stmt->execute();

// Redirect to the desired location (index.php)
header('Location: events.php');
exit();  // Exit after generating and storing the QR code
?>
