here i will list all rules by fifa that can be important for this project. 

number of matches, match types, players, groups, overtimes, draw, logistics, locations etc. 


The 2026 FIFA World Cup is the 23rd edition of the tournament, and it is the biggest one ever planned. It will be the first World Cup with 48 teams, 104 matches, and three host countries: the United States, Canada, and Mexico.

The tournament runs from June 11 to July 19, 2026, so it lasts about 39 days.

48 teams in 12 groups, so 4 teams per group. 
104 matches in total. 

- Group stage(72 matches):
    6 matches per group(every team plays the other 3)
    The top 2 advances automatically --> 24 teams
        Then the 8 best third-place teams --> 8 teams

- Knockout stage(32 matches):
    Single elimination.
    Round of 32 - 16 matches
    Round of 16 - 8 matches
    Quarterfinals - 4 matches
    Semifinals - 2 matches
    Final - 1 match
    Third-place - 1 match

- First match: June 11, 19:00 UTC
    --> this is the deadline for predicting the winner and top scorer


Group Phase Turn Blocks:Matches 1 to 24 consist entirely of Turn 1 matches for Groups A through L.Matches 25 to 48 consist of Turn 2 matches for Groups A through L.Matches 49 to 72 consist of Turn 3 matches for Groups A through L.Alphabetical Cluster Logic inside a Turn:Instead of looking at the clock, the file forces pairs of matches within the same letter group together. Look closely at the group rotation for the first 24 entries:Matches 1 & 2 $\rightarrow$ Group AMatches 3 & 8 $\rightarrow$ Group B (split by time slots but bundled near each other)Matches 5 & 7 $\rightarrow$ Group CMatches 4 & 6 $\rightarrow$ Group DMatches 9 & 10 $\rightarrow$ Group EMatches 11 & 12 $\rightarrow$ Group FMatches 15 & 16 $\rightarrow$ Group GMatches 13 & 14 $\rightarrow$ Group HMatches 17 & 18 $\rightarrow$ Group IMatches 19 & 20 $\rightarrow$ Group JMatches 23 & 24 $\rightarrow$ Group KMatches 21 & 22 $\rightarrow$ Group LKnockout Stage Progression (Matches 73 to 104):Once the group phase wraps up at Match 72, the IDs change order logic completely. They are structured sequentially by tournament phase depth:Matches 73 to 88: Round of 32Matches 89 to 96: Round of 16Matches 97 to 100: Quarter-finalsMatches 101 & 102: Semi-finalsMatch 103: 3rd Place Play-offMatch 104: The World Cup Final