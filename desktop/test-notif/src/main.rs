use notify_rust::Notification;

fn main() {
    println!("Sending test notification...");

    match Notification::new()
        .summary("Orkestrate")
        .body("Notifications are working. You have full desktop control.")
        .show()
    {
        Ok(_) => {
            println!("Notification sent successfully.");
            // Keep alive briefly so user can see it
            std::thread::sleep(std::time::Duration::from_secs(5));
        }
        Err(e) => {
            eprintln!("Failed to send notification: {}", e);
            std::process::exit(1);
        }
    }
}
