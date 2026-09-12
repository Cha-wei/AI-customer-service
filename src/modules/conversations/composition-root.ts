import { prisma } from "@/lib/prisma";

import { PrismaConversationRepository } from "./prisma-repository";
import { ConversationService } from "./service";

let conversationService: ConversationService | undefined;

export function getConversationService(): ConversationService {
  if (!conversationService) {
    conversationService = new ConversationService(
      new PrismaConversationRepository(prisma),
    );
  }

  return conversationService;
}
