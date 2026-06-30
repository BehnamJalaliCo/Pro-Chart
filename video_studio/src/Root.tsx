import { Composition } from "remotion";
import { BlogVideo } from "./BlogVideo";
import { ShortVideo } from "./ShortVideo";
import { RealChartDemo } from "./RealChart";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="RealChartDemo" component={RealChartDemo as any} fps={30} width={1920} height={1080}
      durationInFrames={130} defaultProps={{ variant: 0 }} />
    <Composition id="BlogVideo" component={BlogVideo as any} fps={30} width={1920} height={1080}
      defaultProps={{ scenes: [], title: "", site: "fx.trade-future.ir/blog" }}
      calculateMetadata={({ props }: any) => {
        const sc = props.scenes || [];
        const sum = sc.reduce((a: number, s: any) => a + (s.frames || 0), 0);
        return { durationInFrames: Math.max(60, sum - Math.max(0, sc.length - 1) * 12) }; // کسرِ هم‌پوشانیِ ترانزیشن‌ها
      }} />
    <Composition id="ShortVideo" component={ShortVideo as any} fps={30} width={1080} height={1920}
      defaultProps={{ footage: "", audio: "", hook: "", site: "fx.trade-future.ir" }}
      calculateMetadata={({ props }: any) => ({ durationInFrames: Math.max(60, props.frames || 210) })} />
  </>
);
