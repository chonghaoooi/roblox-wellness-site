// Keep this endpoint inert in case an old scheduler still calls it.
export async function GET() {
  return Response.json({ disabled: true, message: "Automatic photo deletion is disabled." }, { status: 410 });
}
