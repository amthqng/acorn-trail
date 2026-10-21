export default {
  async scheduled(_event, env) {
    if (!env.GITHUB_DISPATCH_TOKEN) throw new Error("GITHUB_DISPATCH_TOKEN is missing");
    const response = await fetch(
      "https://api.github.com/repos/amthqng/acorn-trail/actions/workflows/product-pipeline.yml/dispatches",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.GITHUB_DISPATCH_TOKEN}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "acorn-trail-board-trigger"
        },
        body: JSON.stringify({ ref: "main" })
      }
    );
    if (response.status !== 204) {
      throw new Error(`GitHub workflow dispatch failed: HTTP ${response.status} ${(await response.text()).slice(0, 400)}`);
    }
    console.log("Dispatched Acorn Trail product controller.");
  }
};
