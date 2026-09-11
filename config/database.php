<?php
require_once __DIR__ . '/config.php';

class Database {
    private static ?PDO $instance = null;

    public static function getInstance(): PDO {
        if (self::$instance === null) {
            self::$instance = self::connect();
        }
        return self::$instance;
    }

    private static function connect(): PDO {
        $driver = DB_DRIVER;

        try {
            if ($driver === 'sqlite') {
                $pdo = new PDO('sqlite:' . SQLITE_PATH);
                $pdo->exec('PRAGMA journal_mode=WAL');
                $pdo->exec('PRAGMA foreign_keys=ON');
                $pdo->exec('PRAGMA synchronous=NORMAL');
            } else {
                $dsn = sprintf(
                    'mysql:host=%s;port=%d;dbname=%s;charset=%s',
                    MYSQL_HOST, MYSQL_PORT, MYSQL_DBNAME, MYSQL_CHARSET
                );
                $pdo = new PDO($dsn, MYSQL_USER, MYSQL_PASS);
            }

            $pdo->setAttribute(PDO::ATTR_ERRMODE,            PDO::ERRMODE_EXCEPTION);
            $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
            $pdo->setAttribute(PDO::ATTR_EMULATE_PREPARES,   false);

            return $pdo;

        } catch (PDOException $e) {
            http_response_code(500);
            die(json_encode(['success' => false, 'message' => 'Database connection failed: ' . $e->getMessage()]));
        }
    }
}
