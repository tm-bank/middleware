import passport from "passport";
import { Strategy as DiscordStrategy, Profile } from "passport-discord";
import { pgPool } from "./db";

const scopes = ["identify", "email"];

passport.serializeUser((user: any, done) => done(null, user.discord_id));
passport.deserializeUser(async (id: string, done) => {
  try {
    const { rows } = await pgPool.query(
      "SELECT * FROM users WHERE discord_id = $1",
      [id]
    );
    if (rows.length === 0) return done(null, false);
    done(null, rows[0]);
  } catch (err) {
    done(err, null);
  }
});

passport.use(
  new DiscordStrategy(
    {
      clientID: process.env.DISCORD_CLIENT_ID || "",
      clientSecret: process.env.DISCORD_CLIENT_SECRET || "",
      callbackURL: process.env.DISCORD_CALLBACK_URL || "",
      scope: scopes,
    },
    async (
      accessToken: string,
      refreshToken: string,
      profile: Profile,
      done
    ) => {
      try {
        const { id, username, avatar, email } = profile;
        const displayName = (profile as any).global_name || username;
        const { rows } = await pgPool.query(
          `INSERT INTO users (discord_id, username, avatar, email, display_name)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (discord_id) DO UPDATE
           SET username = EXCLUDED.username,
               avatar = EXCLUDED.avatar,
               email = EXCLUDED.email,
               display_name = EXCLUDED.display_name
           RETURNING *`,
          [id, username, avatar, email, displayName]
        );
        return done(null, rows[0]);
      } catch (err) {
        return done(err as Error);
      }
    }
  )
);

export default passport;