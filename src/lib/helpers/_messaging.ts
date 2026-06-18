export class PipeNotify {
  url: string;

  constructor(webhook: string) {
    this.url = webhook;
  }

  async Info(
    timestamp: number,
    { name, data }: { name: string; data: string },
  ) {
    const blocks = formatInfo(timestamp, { name, data });

    const resp = await fetch(this.url, {
      method: "POST",
      body: JSON.stringify({ blocks }),
      headers: { "Content-Type": "application/json" },
    }).then((res) => res.text());

    return resp;
  }

  async Error(timestamp: number, { name }: { name: string }) {
    const blocks = formatError(timestamp, { name });

    const resp = await fetch(this.url, {
      method: "POST",
      body: JSON.stringify({ blocks }),
      headers: { "Content-Type": "application/json" },
    }).then((res) => res.text());

    return resp;
  }
}

function formatInfo(
  timestamp: number,
  { name, data }: { name: string; data: string },
) {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `Scheduled scraper ${name} ran at ${timestamp}`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${"````"}${data}${"````"}`,
      },
    },
  ];
}
function formatError(timestamp: number, { name }: { name: string }) {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `<!channel> ⚠️ An error occurred in scraper ${name} at ${timestamp}`,
      },
    },
  ];
}
