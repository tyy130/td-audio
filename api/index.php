

// Disabled for Vercel deployments. Legacy Hostinger PHP API preserved in `api/index.php.hostinger`.
header('Content-Type: application/json');
http_response_code(410);
echo json_encode(['message' => 'Legacy PHP API disabled on Vercel deployments']);
exit(0);


// Load server-only config provided at deploy time (not committed to git)
// The deploy script may write `api/config.php` into the project root, or to a safer
// location outside the webroot. We prefer a remote-config path if set, then a
// HOME-based path (e.g., /home/<user>/.config/slughouse/api-config.php), and
// finally fall back to the local `api/config.php` inside the repo.

$remoteConfig = getenv('HOSTINGER_REMOTE_CONFIG') ?: '';
if (empty($remoteConfig)) {
    $home = getenv('HOME') ?: '';
    if (!empty($home)) {
        $remoteConfig = rtrim($home, '/\\') . '/.config/slughouse/api-config.php';
    }
}

if (!empty($remoteConfig) && file_exists($remoteConfig)) {
    $config = require $remoteConfig;
} else {
    $config = require __DIR__ . '/config.php';
}
define('DB_HOST', $config['DB_HOST']);
define('DB_NAME', $config['DB_NAME']);
define('DB_USER', $config['DB_USER']);
define('DB_PASS', $config['DB_PASS']);
define('ADMIN_TOKEN', $config['ADMIN_TOKEN'] ?? '');

define('UPLOAD_DIR', __DIR__ . '/../uploads/');
define('MEDIA_BASE_URL', getenv('MEDIA_BASE_URL') ?: 'https://playback.slughouse/uploads/');
define('MAX_UPLOAD_BYTES', getenv('MAX_UPLOAD_BYTES') ?: 26214400);

if (!is_dir(UPLOAD_DIR)) mkdir(UPLOAD_DIR, 0755, true);

function getDb() {
    static $pdo = null;
    if ($pdo === null) {
        try {
            $pdo = new PDO(
                'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
                DB_USER,
                DB_PASS,
                [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                 PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
            );
        } catch (PDOException $e) {
            http_response_code(500);
            die(json_encode(['message' => 'Database connection failed']));
        }
    }
    return $pdo;
}

function requireAdmin() {
    if (ADMIN_TOKEN === '') return;
    $token = $_SERVER['HTTP_X_ADMIN_TOKEN'] ?? '';
    if ($token !== ADMIN_TOKEN) {
        http_response_code(401);
        die(json_encode(['message' => 'Unauthorized']));
    }
}

$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$path = preg_replace('#^.*/api/?#', '', $path);

try {
    if ($path === 'health' && $method === 'GET') {
        echo json_encode(['status' => 'ok']);
        exit;
    }
    
    if ($path === 'tracks' && $method === 'GET') {
        $db = getDb();
        $rows = $db->query('SELECT * FROM tracks ORDER BY added_at ASC')->fetchAll();
        echo json_encode(array_map(fn($r) => [
            'id' => $r['id'],
            'title' => $r['title'],
            'artist' => $r['artist'],
            'src' => $r['audio_url'],
            'storagePath' => $r['audio_path'],
            'coverArt' => $r['cover_art'],
            'duration' => (int)$r['duration'],
            'addedAt' => (int)$r['added_at']
        ], $rows));
        exit;
    }
    
    if ($path === 'tracks' && $method === 'POST') {
        requireAdmin();
        if (!isset($_FILES['file'])) {
            http_response_code(400);
            die(json_encode(['message' => 'Missing file']));
        }
        
        $file = $_FILES['file'];
        $id = $_POST['id'] ?? die(json_encode(['message' => 'Missing id']));
        $title = $_POST['title'] ?? 'Untitled';
        $artist = $_POST['artist'] ?? 'Unknown';
        $coverArt = $_POST['coverArt'] ?? null;
        $duration = (int)($_POST['duration'] ?? 0);
        $addedAt = (int)($_POST['addedAt'] ?? time() * 1000);
        
        if ($file['error'] !== 0 || $file['size'] > MAX_UPLOAD_BYTES) {
            http_response_code(400);
            die(json_encode(['message' => 'Upload error']));
        }
        
        $safeName = preg_replace('/[^a-z0-9.]+/', '-', strtolower($file['name']));
        $filename = $id . '-' . time() . '-' . $safeName;
        $filepath = UPLOAD_DIR . $filename;
        
        if (!move_uploaded_file($file['tmp_name'], $filepath)) {
            http_response_code(500);
            die(json_encode(['message' => 'Failed to save']));
        }
        
        $audioUrl = MEDIA_BASE_URL . $filename;
        
        try {
            $db = getDb();
            $stmt = $db->prepare('INSERT INTO tracks (id,title,artist,audio_url,audio_path,cover_art,duration,added_at) VALUES (?,?,?,?,?,?,?,?)');
            $stmt->execute([$id, $title, $artist, $audioUrl, $filename, $coverArt, $duration, $addedAt]);
            echo json_encode(['id' => $id, 'title' => $title, 'artist' => $artist, 'src' => $audioUrl, 'storagePath' => $filename, 'coverArt' => $coverArt, 'duration' => $duration, 'addedAt' => $addedAt]);
        } catch (PDOException $e) {
            @unlink($filepath);
            http_response_code($e->getCode() === '23000' ? 409 : 500);
            die(json_encode(['message' => 'Database error']));
        }
        exit;
    }
    
    if (preg_match('#^tracks/([a-zA-Z0-9-]+)$#', $path, $m) && $method === 'DELETE') {
        requireAdmin();
        $db = getDb();
        $stmt = $db->prepare('SELECT audio_path FROM tracks WHERE id = ?');
        $stmt->execute([$m[1]]);
        $track = $stmt->fetch();
        if (!$track) {
            http_response_code(404);
            die(json_encode(['message' => 'Not found']));
        }
        $db->prepare('DELETE FROM tracks WHERE id = ?')->execute([$m[1]]);
        if ($track['audio_path']) @unlink(UPLOAD_DIR . $track['audio_path']);
        http_response_code(204);
        exit;
    }
    
    http_response_code(404);
    echo json_encode(['message' => 'Not found']);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['message' => 'Error']);
}

