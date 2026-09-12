import { DELETE } from "../session/route";

export async function POST(request: Request) {
  return DELETE(request);
}
