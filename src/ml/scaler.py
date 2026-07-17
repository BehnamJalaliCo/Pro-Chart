from __future__ import annotations
from dataclasses import dataclass
from pathlib import Path
import joblib
import pandas as pd
from sklearn.preprocessing import StandardScaler, RobustScaler, MinMaxScaler
@dataclass
class FittedScaler:
    feature_columns:list[str]; scaler_type:str; _scaler:object
    def transform(self,df):
        missing=[c for c in self.feature_columns if c not in df]
        if missing: raise ValueError(f"missing feature column: {missing[0]}")
        return pd.DataFrame(self._scaler.transform(df[self.feature_columns]),columns=self.feature_columns,index=df.index)
    def save(self,path): joblib.dump(self,path)
    @classmethod
    def load(cls,path): return joblib.load(path)
def fit_scaler(df,feature_columns,scaler_type='standard'):
    types={'standard':StandardScaler,'robust':RobustScaler,'minmax':MinMaxScaler}
    if scaler_type not in types: raise ValueError('unknown scaler type')
    obj=types[scaler_type]().fit(df[feature_columns]); return FittedScaler(list(feature_columns),scaler_type,obj)
