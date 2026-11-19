import { Global, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { assertMediaDirWritable, parseEnv } from "./env.schema";

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (raw) => {
        const env = parseEnv(raw);
        assertMediaDirWritable(env.MEDIA_DIR);
        return env;
      },
    }),
  ],
  exports: [ConfigModule],
})
export class AppConfigModule {}
