export default async function handler(req, res) {
    res.status(200).json({ message: "Manual roll disabled. The protocol is now trust-minimal and player-driven." });
}
