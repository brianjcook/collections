<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$date = $_GET['date'] ?? gmdate('Y-m-d');

if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid date format. Use YYYY-MM-DD.']);
    exit;
}

$url = 'https://www.nytimes.com/svc/connections/v2/' . $date . '.json';
$userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

$body = false;
$statusCode = 0;

if (function_exists('curl_init')) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_HTTPHEADER => [
            'Accept: application/json',
            'Referer: https://www.nytimes.com/games/connections',
        ],
        CURLOPT_USERAGENT => $userAgent,
    ]);

    $body = curl_exec($ch);
    $statusCode = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
} else {
    $context = stream_context_create([
        'http' => [
            'method' => 'GET',
            'timeout' => 20,
            'header' => "Accept: application/json\r\n" .
                "Referer: https://www.nytimes.com/games/connections\r\n" .
                "User-Agent: {$userAgent}\r\n",
        ],
    ]);

    $body = @file_get_contents($url, false, $context);
    if (isset($http_response_header[0]) && preg_match('/\s(\d{3})\s/', $http_response_header[0], $m)) {
        $statusCode = (int) $m[1];
    }
}

if ($body === false || $statusCode < 200 || $statusCode >= 300) {
    http_response_code(502);
    echo json_encode([
        'error' => 'Failed to retrieve puzzle from NYT.',
        'upstream_status' => $statusCode ?: null,
    ]);
    exit;
}

$decoded = json_decode($body, true);
if (!is_array($decoded)) {
    http_response_code(502);
    echo json_encode(['error' => 'Invalid JSON returned by NYT.']);
    exit;
}

echo json_encode($decoded);
