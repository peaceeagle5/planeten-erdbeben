-- Läuft einmal beim ersten Start des MariaDB-Containers.
-- Benutzer "lernen" darf nur lesen: für die SQL-Übungen (lernen/06) und die Analyse (lernen/11).
-- So kann beim Üben nichts versehentlich gelöscht werden.
CREATE USER IF NOT EXISTS 'lernen'@'%' IDENTIFIED BY 'lernen';
GRANT SELECT ON planeten_erdbeben.* TO 'lernen'@'%';
FLUSH PRIVILEGES;
