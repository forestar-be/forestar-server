-- CreateTable
CREATE TABLE "PhoneCallback" (
    "id" SERIAL NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "responsiblePerson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventId" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PhoneCallback_pkey" PRIMARY KEY ("id")
);
