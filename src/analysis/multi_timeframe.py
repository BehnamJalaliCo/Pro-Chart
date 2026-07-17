class MultiTimeframeAnalyzer:
    def analyze(self, candles=None, analyses=None):
        analyses=analyses or {}
        if not analyses:return {'direction':'neutral','confluence_count':0,'net_confluence':0,'weighted_score':0.,'higher_tf_bias':'neutral','conflict':False,'aligned':False,'bullish_tfs':0,'bearish_tfs':0,'timeframe_details':{}}
        bull=sum(1 for x in analyses.values() if x.get('technical_score',50)>=50); bear=len(analyses)-bull; net=bull-bear
        higher=[x.get('technical_score',50) for k,x in analyses.items() if k in ('MN1','W1','D1','H4')]
        hb='bullish' if sum(v>=50 for v in higher)>=max(1,len(higher)/2) else 'bearish'
        return {'direction':'bullish' if net>0 else 'bearish' if net<0 else 'neutral','confluence_count':len(analyses),'net_confluence':net,'weighted_score':sum(x.get('technical_score',50) for x in analyses.values())/len(analyses),'higher_tf_bias':hb,'conflict':bull>0 and bear>0,'aligned':bull==0 or bear==0,'bullish_tfs':bull,'bearish_tfs':bear,'timeframe_details':analyses}
    @staticmethod
    def is_signal_against_higher_bias(direction,bias): return (direction=='long' and bias=='bearish') or (direction=='short' and bias=='bullish')
