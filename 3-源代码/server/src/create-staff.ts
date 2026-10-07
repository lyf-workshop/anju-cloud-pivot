// Explicit local/operator account provisioning. Password is read from environment, never CLI arguments or logs.
import { z } from "zod";
import { settings } from "./config.js";
import { Store } from "./db.js";
import { passwordHash } from "./staff.js";
import { id, now } from "./core.js";

const schema = z.object({
  username: z.string().regex(/^[a-zA-Z0-9_-]{3,60}$/),
  password: z.string().min(12).max(200),
  nickname: z.string().trim().min(1).max(30),
  communityId: z.string().trim().min(1),
  role: z.enum(["manager", "operator", "viewer"]),
});
const parsed = schema.safeParse({
  username: process.env.STAFF_USERNAME,
  password: process.env.STAFF_PASSWORD,
  nickname: process.env.STAFF_NICKNAME,
  communityId: process.env.STAFF_COMMUNITY_ID,
  role: process.env.STAFF_ROLE || "operator",
});
if (!parsed.success) {
  console.error(
    "请配置 STAFF_USERNAME / STAFF_PASSWORD（至少12字符）/ STAFF_NICKNAME / STAFF_COMMUNITY_ID / STAFF_ROLE。密码不要写入命令行参数或提交Git。",
  );
  process.exitCode = 1;
} else {
  const cfg = settings(),
    db = new Store(cfg),
    p = parsed.data;
  try {
    if (!db.one("SELECT id FROM communities WHERE id=?", p.communityId))
      throw new Error("指定社区不存在，请先配置社区目录");
    if (
      db.one("SELECT user_id FROM staff_accounts WHERE username=?", p.username)
    )
      throw new Error("账号已存在；不会覆盖原密码或权限");
    db.tx(() => {
      const uid = id();
      db.run(
        "INSERT INTO users VALUES (?,?,?,?,?)",
        uid,
        "staff:" + p.username,
        p.nickname,
        now(),
        cfg.legalVersion,
      );
      db.run(
        "INSERT INTO staff_accounts VALUES (?,?,?,?)",
        uid,
        p.username,
        passwordHash(p.password),
        1,
      );
      db.run(
        "INSERT INTO staff_memberships VALUES (?,?,?)",
        uid,
        p.communityId,
        p.role,
      );
    });
    console.log("物业账号已创建，社区与角色已分配。不会打印密码。");
  } catch (error) {
    console.error((error as Error).message);
    process.exitCode = 1;
  } finally {
    db.close();
  }
}
