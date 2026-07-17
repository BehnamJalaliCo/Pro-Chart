from src.ml.scaler import fit_scaler
class Trainer:
    def _fit_and_save_scaler(self,df,columns,path): return fit_scaler(df,columns).save(path)
    def train_technical(self,*a,**k): return self._fit_and_save_scaler(*a,**k)
    def train_pattern(self,*a,**k): return self._fit_and_save_scaler(*a,**k)
    def train_ml(self,*a,**k): return self._fit_and_save_scaler(*a,**k)
