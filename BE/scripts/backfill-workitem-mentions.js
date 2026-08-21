require("dotenv").config({ path: process.env.DOTENV_CONFIG_PATH || ".env.development" });

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function normalizeMentionText(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\u00A0/g, " ")
    .normalize("NFC")
    .toLocaleLowerCase("vi-VN")
    .replace(/\s+/g, " ")
    .trim();
}

function extractMentionEmails(content) {
  return Array.from(
    new Set(
      Array.from(String(content || "").matchAll(/@([\w.+-]+@[\w.-]+\.[A-Za-z]{2,})/g))
        .map((match) => match[1].toLowerCase())
    )
  );
}

async function main() {
  const sinceDays = Number(process.env.BACKFILL_MENTION_DAYS || 7);
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
  const users = await prisma.user.findMany({
    where: { deletedAt: null, status: "ACTIVE" },
    select: { id: true, name: true, email: true }
  });

  const comments = await prisma.workItemComment.findMany({
    where: { content: { contains: "@" }, createdAt: { gte: since } },
    include: {
      workItem: { select: { id: true } },
      createdBy: { select: { id: true, name: true, email: true } }
    },
    orderBy: { createdAt: "asc" }
  });

  let created = 0;
  for (const comment of comments) {
    const normalizedContent = normalizeMentionText(comment.content);
    const emailSet = new Set(extractMentionEmails(comment.content));
    const mentionedUsers = users.filter((user) =>
      user.id !== comment.createdById &&
      (
        emailSet.has(user.email.toLowerCase()) ||
        Boolean(user.name && normalizedContent.includes(`@${normalizeMentionText(user.name)}`))
      )
    );

    for (const user of mentionedUsers) {
      const existing = await prisma.notification.findFirst({
        where: {
          userId: user.id,
          title: "Bạn được nhắc đến trong ticket",
          entityType: "WorkItem",
          entityId: comment.workItemId,
          createdAt: { gte: comment.createdAt }
        },
        select: { id: true }
      });
      if (existing) continue;

      await prisma.notification.create({
        data: {
          userId: user.id,
          title: "Bạn được nhắc đến trong ticket",
          message: `${comment.createdByName || comment.createdByEmail || comment.createdBy?.name || "Một thành viên"} đã nhắc đến bạn trong ticket.`,
          entityType: "WorkItem",
          entityId: comment.workItemId,
          createdAt: comment.createdAt
        }
      });
      created += 1;
    }
  }

  console.log(`Backfilled ${created} work item mention notification(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
