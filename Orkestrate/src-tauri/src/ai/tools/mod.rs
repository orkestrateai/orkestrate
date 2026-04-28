const SEARCH_CONTEXT_DESC: &str = include_str!("descriptions/search_context.txt");
const FETCH_URL_DESC: &str = include_str!("descriptions/fetch_url.txt");
const WEB_SEARCH_DESC: &str = include_str!("descriptions/web_search.txt");

pub fn get_tools_block() -> String {
    let year = chrono::Local::now().format("%Y").to_string();
    let web_search = WEB_SEARCH_DESC.replace("{{year}}", &year);

    format!(
        "[AVAILABLE TOOLS]\n\
         ---\n\
         search_context (built-in):\n\
         {}\n\
         ---\n\
         fetch_url (built-in):\n\
         {}\n\
         ---\n\
         web_search (built-in):\n\
         {}\n\
         [/AVAILABLE TOOLS]",
        SEARCH_CONTEXT_DESC.trim(),
        FETCH_URL_DESC.trim(),
        web_search.trim(),
    )
}
