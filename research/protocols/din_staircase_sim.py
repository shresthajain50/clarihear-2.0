# Monte Carlo: bias/SD of SRT estimate for candidate DIN configs (ideal listener, logistic triplet PF)
import math,random
def p(snr,srt,slope=0.20):  # slope = %/dB at 50% point (Potgieter 2016: ~20%/dB for triplets)
    k=4*slope; return 1/(1+math.exp(-k*(snr-srt)))
def run(cfg,srt):
    snr=cfg['start']; track=[]
    for i in range(cfg['n']):
        track.append(snr); c=random.random()<p(snr,srt)
        big = i < cfg.get('big_steps',0)
        snr += (-4 if big else -2) if c else 2
    track.append(snr)  # virtual next trial
    a,b=cfg['avg']; return sum(track[a-1:b])/(b-a+1)
cfgs={
 'provisional (24, 0dB, 2dB, mean 5-24)':dict(n=24,start=0,avg=(5,24)),
 'hearZA/DeSousa (23, 0dB, 4dB x3, last19 = 5-23)':dict(n=23,start=0,big_steps=3,avg=(5,23)),
 'hearZA variant incl virtual (6-24)':dict(n=23,start=0,big_steps=3,avg=(6,24)),
 'Potgieter2016 (23, 2dB, 4-23)':dict(n=23,start=0,avg=(4,23)),
 'Smits-like 24, 2dB, 5-25 incl virtual':dict(n=24,start=0,avg=(5,25)),
}
random.seed(1)
for srt in (-10,-17,-5):
    print(f'true SRT {srt}')
    for k,c in cfgs.items():
        xs=[run(c,srt) for _ in range(20000)]; m=sum(xs)/len(xs); sd=(sum((x-m)**2 for x in xs)/len(xs))**.5
        print(f'  {k:50s} bias {m-srt:+.2f} dB  SD {sd:.2f}')
