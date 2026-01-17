<?php
define('CLI_SCRIPT', true);
require('config.php');

$token_str = 'abcdef1234567890abcdef1234567890';
echo "Searching for token: $token_str\n";

$token = $DB->get_record('external_tokens', array('token' => $token_str));

if ($token) {
    echo "Token FOUND: \n";
    print_r($token);
} else {
    echo "Token NOT FOUND via API.\n";

    // raw sql check
    $record = $DB->get_record_sql("SELECT * FROM {external_tokens} WHERE token = ?", [$token_str]);
    if ($record) {
        echo "Token FOUND via raw SQL.\n";
    } else {
        echo "Token NOT FOUND via raw SQL.\n";
    }
}
