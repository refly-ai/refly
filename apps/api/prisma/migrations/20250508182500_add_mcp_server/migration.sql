-- CreateTable
CREATE TABLE "mcp_servers" (
    "pk" SERIAL NOT NULL,
    "server_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "is_global" BOOLEAN NOT NULL DEFAULT false,
    "uid" TEXT,
    "url" TEXT,
    "command" TEXT,
    "args" TEXT,
    "env" TEXT,
    "headers" TEXT,
    "reconnect" TEXT,
    "config" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "mcp_servers_pkey" PRIMARY KEY ("pk")
);

-- CreateIndex
CREATE UNIQUE INDEX "mcp_servers_server_id_key" ON "mcp_servers"("server_id");

-- CreateIndex
CREATE INDEX "mcp_servers_uid_deleted_at_idx" ON "mcp_servers"("uid", "deleted_at");

-- CreateIndex
CREATE INDEX "mcp_servers_is_global_idx" ON "mcp_servers"("is_global");
