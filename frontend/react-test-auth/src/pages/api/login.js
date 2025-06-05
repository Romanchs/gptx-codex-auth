export default function handler(req, res) {
  if (req.method === 'POST') {
    // just echo back for demo
    res.status(200).json({ success: true });
  } else {
    res.status(405).end();
  }
}
